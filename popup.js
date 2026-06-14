const startButton = document.getElementById("start");
const stopButton = document.getElementById("stop");
const statusElement = document.getElementById("status");
const siteBadge = document.getElementById("site-badge");
const spinnerElement = document.getElementById("status-spinner");
const speedButtons = document.querySelectorAll(".speed-btn");

// Stats elements
const statClippedElement = document.getElementById("stat-clipped");
const statFailedElement = document.getElementById("stat-failed");
const statPassesElement = document.getElementById("stat-passes");

const START_MESSAGE = "couponClipper:start";
const siteRegistry = globalThis.CouponClipperSites;

let isCurrentlyClipping = false;
let activeSpeed = "normal";

const SPEED_CONFIGS = {
  safe: { clickDelayMs: 2000, scrollDelayMs: 2200 },
  normal: { clickDelayMs: 1200, scrollDelayMs: 1400 },
  fast: { clickDelayMs: 600, scrollDelayMs: 800 }
};

function setStatus(message) {
  if (statusElement) {
    statusElement.textContent = message;
  }
}

function updateStats(clipped = 0, failed = 0, passes = 0) {
  if (statClippedElement) statClippedElement.textContent = clipped;
  if (statFailedElement) statFailedElement.textContent = failed;
  if (statPassesElement) statPassesElement.textContent = passes;
}

function setSpinner(visible) {
  if (spinnerElement) {
    if (visible) {
      spinnerElement.classList.remove("hidden");
    } else {
      spinnerElement.classList.add("hidden");
    }
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

function setUiState(state) {
  // state can be: 'unsupported', 'ready', 'open-coupons', 'clipping', 'stopping'
  const disableSpeed = (state === "clipping" || state === "stopping");
  speedButtons.forEach(btn => {
    btn.disabled = disableSpeed;
  });

  switch (state) {
    case "unsupported":
      if (startButton) {
        startButton.disabled = true;
        startButton.classList.remove("hidden");
        startButton.textContent = "Start";
      }
      if (stopButton) {
        stopButton.disabled = true;
        stopButton.classList.add("hidden");
      }
      setSpinner(false);
      break;

    case "ready":
      isCurrentlyClipping = false;
      if (startButton) {
        startButton.disabled = false;
        startButton.classList.remove("hidden");
        startButton.textContent = "Start";
      }
      if (stopButton) {
        stopButton.disabled = true;
        stopButton.classList.add("hidden");
      }
      setSpinner(false);
      break;

    case "open-coupons":
      isCurrentlyClipping = false;
      if (startButton) {
        startButton.disabled = false;
        startButton.classList.remove("hidden");
      }
      if (stopButton) {
        stopButton.disabled = true;
        stopButton.classList.add("hidden");
      }
      setSpinner(false);
      break;

    case "clipping":
      isCurrentlyClipping = true;
      if (startButton) {
        startButton.disabled = true;
        startButton.classList.add("hidden");
      }
      if (stopButton) {
        stopButton.disabled = false;
        stopButton.classList.remove("hidden");
      }
      setSpinner(true);
      break;

    case "stopping":
      if (startButton) {
        startButton.disabled = true;
      }
      if (stopButton) {
        stopButton.disabled = true;
      }
      setSpinner(true);
      break;
  }
}

async function getActiveTab() {
  const [tab] = await queryActiveTab();
  return tab;
}

function updateBadge(site) {
  if (!siteBadge) return;

  // Clear previous badge classes
  siteBadge.className = "badge";

  if (!site) {
    siteBadge.textContent = "Unsupported";
    siteBadge.classList.add("badge-unsupported");
  } else {
    siteBadge.textContent = site.displayName;
    siteBadge.classList.add(`badge-${site.id}`);
  }
}

async function refreshPopupState() {
  try {
    const tab = await getActiveTab();
    const site = siteRegistry.findSiteByUrl(tab?.url);

    updateBadge(site);

    if (!tab?.id || !site) {
      setUiState("unsupported");
      setStatus("Open a supported coupon site to start.");
      updateStats(0, 0, 0);
      return;
    }

    if (!siteRegistry.isCouponPage(site, tab.url)) {
      setUiState("open-coupons");
      if (startButton) startButton.textContent = site.popup.openLabel;
      setStatus(`Click to open ${site.displayName} coupons.`);
      updateStats(0, 0, 0);
      return;
    }

    // Tab is on a valid coupon page, check if clipper is already running
    try {
      const response = await sendMessageToTab(tab.id, { type: "couponClipper:status_query" });
      if (response && response.running) {
        setUiState("clipping");
        setStatus("Clipper is running in this tab...");
        updateStats(response.clickedCount, response.failedCount, response.scannedPasses);
        return;
      }
    } catch (e) {
      // Content script may not be loaded yet, which is fine
    }

    // Default state: ready to start
    setUiState("ready");
    setStatus("Ready.");
    updateStats(0, 0, 0);
  } catch (error) {
    setUiState("unsupported");
    setStatus(error.message);
  }
}

function buildStatusMessage(result) {
  if (result.stopped) {
    return `Stopped by user. Clipped ${result.clickedCount} coupon${result.clickedCount === 1 ? "" : "s"}.`;
  }

  if (result.clickedCount === 0) {
    return result.reachedBottom
      ? "No coupon buttons found after scanning the page."
      : "No visible coupon buttons found.";
  }

  if (result.failedCount > 0) {
    return `Completed: Clipped ${result.clickedCount}; ${result.failedCount} failed.`;
  }

  return `Completed: Clipped ${result.clickedCount} coupon${
    result.clickedCount === 1 ? "" : "s"
  }.`;
}

async function startClipping() {
  if (!startButton) return;

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

    setUiState("clipping");
    setStatus("Scanning coupon page...");
    updateStats(0, 0, 0);

    let result;
    const config = SPEED_CONFIGS[activeSpeed] || SPEED_CONFIGS.normal;
    const startPayload = {
      type: START_MESSAGE,
      clickDelayMs: config.clickDelayMs,
      scrollDelayMs: config.scrollDelayMs
    };

    try {
      result = await sendMessageToTab(tab.id, startPayload);
    } catch (error) {
      if (!isMissingContentScriptError(error)) {
        throw error;
      }

      setStatus("Injecting helper scripts...");
      await executeContentScript(tab.id);
      result = await sendMessageToTab(tab.id, startPayload);
    }

    if (!result?.ok) {
      setStatus(result?.error || "Could not start clipping.");
      setUiState("ready");
      return;
    }

    setStatus(buildStatusMessage(result));
    setUiState("ready");
  } catch (error) {
    setStatus(error.message);
    setUiState("ready");
  }
}

async function stopClipping() {
  if (!stopButton) return;

  setUiState("stopping");
  setStatus("Stopping clipper...");

  try {
    const tab = await getActiveTab();
    if (tab?.id) {
      await sendMessageToTab(tab.id, { type: "couponClipper:stop" });
    }
  } catch (error) {
    setStatus(`Error stopping: ${error.message}`);
    setUiState("ready");
  }
}

// Listen for progress updates from the content script
chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "couponClipper:progress") {
    updateStats(message.clickedCount, message.failedCount, message.scannedPasses);
    
    if (message.status === "clipping" || message.status === "started") {
      setUiState("clipping");
      setStatus(`Clipped ${message.clickedCount} coupons. Scanning page...`);
    } else if (message.status === "completed" || message.status === "stopped") {
      setUiState("ready");
      if (message.status === "completed") {
        setStatus(`Done! Clipped ${message.clickedCount} coupon${message.clickedCount === 1 ? "" : "s"}.`);
      } else {
        setStatus(`Stopped. Clipped ${message.clickedCount} coupon${message.clickedCount === 1 ? "" : "s"}.`);
      }
    }
  }
});

function updateSpeedActiveState(speed) {
  speedButtons.forEach(btn => {
    if (btn.dataset.speed === speed) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });
}

// Load saved speed
if (chrome.storage?.local) {
  chrome.storage.local.get(["clipperSpeed"], (result) => {
    if (result.clipperSpeed && SPEED_CONFIGS[result.clipperSpeed]) {
      activeSpeed = result.clipperSpeed;
      updateSpeedActiveState(activeSpeed);
    }
  });
}

speedButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    if (isCurrentlyClipping) return;
    const speed = btn.dataset.speed;
    activeSpeed = speed;
    updateSpeedActiveState(speed);
    
    if (chrome.storage?.local) {
      chrome.storage.local.set({ clipperSpeed: speed });
    }
  });
});

startButton?.addEventListener("click", startClipping);
stopButton?.addEventListener("click", stopClipping);
refreshPopupState();
