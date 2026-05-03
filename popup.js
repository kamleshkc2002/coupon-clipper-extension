const startButton = document.getElementById("start");
const statusElement = document.getElementById("status");

const START_MESSAGE = "couponClipper:start";
const siteRegistry = globalThis.CouponClipperSites;

function setStatus(message) {
  if (statusElement) {
    statusElement.textContent = message;
  }
}

function queryActiveTab() {
  if (globalThis.browser?.tabs?.query) {
    return globalThis.browser.tabs.query({ active: true, currentWindow: true });
  }

  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const error = chrome.runtime.lastError;

      if (error) {
        reject(new Error(error.message));
        return;
      }

      resolve(tabs);
    });
  });
}

function updateTab(tabId, updates) {
  if (globalThis.browser?.tabs?.update) {
    return globalThis.browser.tabs.update(tabId, updates);
  }

  return new Promise((resolve, reject) => {
    chrome.tabs.update(tabId, updates, (tab) => {
      const error = chrome.runtime.lastError;

      if (error) {
        reject(new Error(error.message));
        return;
      }

      resolve(tab);
    });
  });
}

function sendMessageToTab(tabId, message) {
  if (globalThis.browser?.tabs?.sendMessage) {
    return globalThis.browser.tabs.sendMessage(tabId, message);
  }

  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      const error = chrome.runtime.lastError;

      if (error) {
        reject(new Error(error.message));
        return;
      }

      resolve(response);
    });
  });
}

function executeContentScript(tabId) {
  if (globalThis.browser?.scripting?.executeScript) {
    return globalThis.browser.scripting.executeScript({
      target: { tabId },
      files: ["sites.js", "content.js"],
    });
  }

  return new Promise((resolve, reject) => {
    chrome.scripting.executeScript(
      {
        target: { tabId },
        files: ["sites.js", "content.js"],
      },
      (result) => {
        const error = chrome.runtime.lastError;

        if (error) {
          reject(new Error(error.message));
          return;
        }

        resolve(result);
      }
    );
  });
}

function isMissingContentScriptError(error) {
  return error.message.includes("Receiving end does not exist");
}

function setStartButton({ disabled, label }) {
  if (!startButton) {
    return;
  }

  startButton.disabled = disabled;

  if (label) {
    startButton.textContent = label;
  }
}

async function getActiveTab() {
  const [tab] = await queryActiveTab();
  return tab;
}

async function refreshPopupState() {
  try {
    const tab = await getActiveTab();
    const site = siteRegistry.findSiteByUrl(tab?.url);

    if (!tab?.id || !site) {
      setStartButton({ disabled: true, label: "Start" });
      setStatus("Open a supported coupon site to start.");
      return;
    }

    if (!siteRegistry.isCouponPage(site, tab.url)) {
      setStartButton({ disabled: false, label: site.popup.openLabel });
      setStatus(`Click to open ${site.displayName} coupons.`);
      return;
    }

    setStartButton({ disabled: false, label: site.popup.startLabel });
    setStatus("Ready.");
  } catch (error) {
    setStartButton({ disabled: true, label: "Start" });
    setStatus(error.message);
  }
}

function buildStatusMessage(result) {
  if (result.clickedCount === 0) {
    return result.reachedBottom
      ? "No coupon buttons found after scanning the page."
      : "No visible coupon buttons found.";
  }

  if (result.failedCount > 0) {
    return `Clicked ${result.clickedCount}; ${result.failedCount} failed.`;
  }

  return `Clicked ${result.clickedCount} coupon button${
    result.clickedCount === 1 ? "" : "s"
  } while scanning the page.`;
}

async function startClipping() {
  if (!startButton) {
    return;
  }

  startButton.disabled = true;
  setStatus("Scanning coupon page...");

  try {
    const tab = await getActiveTab();
    const site = siteRegistry.findSiteByUrl(tab?.url);

    if (!tab?.id || !site) {
      setStatus("Open a supported coupon site to start.");
      return;
    }

    if (!siteRegistry.isCouponPage(site, tab.url)) {
      setStatus(`Opening ${site.displayName} coupons...`);
      await updateTab(tab.id, { url: site.startUrl });
      return;
    }

    let result;

    try {
      result = await sendMessageToTab(tab.id, { type: START_MESSAGE });
    } catch (error) {
      if (!isMissingContentScriptError(error)) {
        throw error;
      }

      setStatus("Starting on this page...");
      await executeContentScript(tab.id);
      result = await sendMessageToTab(tab.id, { type: START_MESSAGE });
    }

    if (!result?.ok) {
      setStatus(result?.error || "Could not start clipping.");
      return;
    }

    setStatus(buildStatusMessage(result));
  } catch (error) {
    setStatus(error.message);
  } finally {
    startButton.disabled = false;
  }
}

startButton?.addEventListener("click", startClipping);
refreshPopupState();
