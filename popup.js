const startButton = document.getElementById("start");
const statusElement = document.getElementById("status");

const BJS_COUPONS_URL = "https://www.bjs.com/myCoupons";
const START_MESSAGE = "couponClipper:start";

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
      files: ["content.js"],
    });
  }

  return new Promise((resolve, reject) => {
    chrome.scripting.executeScript(
      {
        target: { tabId },
        files: ["content.js"],
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

function parseUrl(url) {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

function isBjsPage(url) {
  const parsedUrl = parseUrl(url);

  return (
    parsedUrl?.protocol === "https:" && parsedUrl.hostname === "www.bjs.com"
  );
}

function isBjsCouponsPage(url) {
  const parsedUrl = parseUrl(url);

  if (!parsedUrl) {
    return false;
  }

  return (
    isBjsPage(url) &&
    parsedUrl.pathname.replace(/\/+$/, "").toLowerCase() === "/mycoupons"
  );
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

    if (!tab?.id || !isBjsPage(tab.url)) {
      setStartButton({ disabled: true, label: "Start" });
      setStatus("Open a BJ's page to start.");
      return;
    }

    if (!isBjsCouponsPage(tab.url)) {
      setStartButton({ disabled: false, label: "Open Coupons" });
      setStatus("Click to open BJ's coupons.");
      return;
    }

    setStartButton({ disabled: false, label: "Start" });
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

    if (!tab?.id || !isBjsPage(tab.url)) {
      setStatus("Open a BJ's page to start.");
      return;
    }

    if (!isBjsCouponsPage(tab.url)) {
      setStatus("Opening BJ's coupons...");
      await updateTab(tab.id, { url: BJS_COUPONS_URL });
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
