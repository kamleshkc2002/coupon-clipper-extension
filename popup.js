const startButton = document.getElementById("start");
const statusElement = document.getElementById("status");

const BJS_URL_PATTERN = /^https:\/\/www\.bjs\.com\//;
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

function buildStatusMessage(result) {
  if (result.clickedCount === 0) {
    return "No visible coupon buttons found.";
  }

  if (result.failedCount > 0) {
    return `Clicked ${result.clickedCount}; ${result.failedCount} failed.`;
  }

  return `Clicked ${result.clickedCount} coupon button${
    result.clickedCount === 1 ? "" : "s"
  }.`;
}

async function startClipping() {
  if (!startButton) {
    return;
  }

  startButton.disabled = true;
  setStatus("Looking for visible coupons...");

  try {
    const [tab] = await queryActiveTab();

    if (!tab?.id) {
      setStatus("Open a BJ's coupon page first.");
      return;
    }

    if (tab.url && !BJS_URL_PATTERN.test(tab.url)) {
      setStatus("Open a BJ's page, then try again.");
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
