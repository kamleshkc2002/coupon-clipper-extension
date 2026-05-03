(() => {
  if (globalThis.__couponClipperContentScriptLoaded) {
    return;
  }

  globalThis.__couponClipperContentScriptLoaded = true;

  const START_MESSAGE = "couponClipper:start";
  const CLICK_DELAY_MS = 1200;
  const CONTROL_SELECTOR =
    "button, [role='button'], a[href], input[type='button'], input[type='submit']";
  const CLIP_PATTERNS = [
    /\+?\s*clip to card\b/i,
    /\bclip\b/i,
    /\bclip coupon\b/i,
    /\badd coupon\b/i,
    /\badd to card\b/i,
    /\bactivate coupon\b/i,
    /\bload to card\b/i,
  ];
  const EXCLUDED_PATTERNS = [
    /\bclipped\b/i,
    /\bunclip\b/i,
    /\bremove\b/i,
    /\bdetails?\b/i,
    /\blearn more\b/i,
    /\bview\b/i,
  ];

  let activeRun = null;

  function delay(ms) {
    return new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });
  }

  function getElementLabel(element) {
    return [
      element.textContent,
      element.getAttribute("aria-label"),
      element.getAttribute("title"),
      element.getAttribute("value"),
      element.getAttribute("data-testid"),
      element.getAttribute("data-test-id"),
      element.id,
      typeof element.className === "string" ? element.className : "",
    ]
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function isDisabled(element) {
    return (
      element.disabled ||
      element.matches("[disabled], [aria-disabled='true']") ||
      Boolean(element.closest("[aria-disabled='true']"))
    );
  }

  function isVisible(element) {
    const style = window.getComputedStyle(element);

    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      style.opacity === "0" ||
      style.pointerEvents === "none"
    ) {
      return false;
    }

    return Array.from(element.getClientRects()).some((rect) => {
      return rect.width > 1 && rect.height > 1;
    });
  }

  function isInViewport(element) {
    const rect = element.getBoundingClientRect();
    const viewportWidth =
      window.innerWidth || document.documentElement.clientWidth;
    const viewportHeight =
      window.innerHeight || document.documentElement.clientHeight;

    return (
      rect.bottom > 0 &&
      rect.right > 0 &&
      rect.top < viewportHeight &&
      rect.left < viewportWidth
    );
  }

  function looksLikeClipAction(element) {
    const label = getElementLabel(element);

    if (!label) {
      return false;
    }

    if (EXCLUDED_PATTERNS.some((pattern) => pattern.test(label))) {
      return false;
    }

    return CLIP_PATTERNS.some((pattern) => pattern.test(label));
  }

  function findVisibleCouponButtons() {
    return Array.from(document.querySelectorAll(CONTROL_SELECTOR)).filter(
      (element) => {
        return (
          !isDisabled(element) &&
          isVisible(element) &&
          isInViewport(element) &&
          looksLikeClipAction(element)
        );
      }
    );
  }

  async function clickCouponButtons() {
    const buttons = findVisibleCouponButtons();
    let clickedCount = 0;
    let failedCount = 0;

    for (const button of buttons) {
      if (!button.isConnected || isDisabled(button) || !isVisible(button)) {
        continue;
      }

      try {
        button.click();
        clickedCount += 1;
      } catch (error) {
        console.warn("Coupon Clipper failed to click a coupon button.", error);
        failedCount += 1;
      }

      await delay(CLICK_DELAY_MS);
    }

    return {
      clickedCount,
      failedCount,
    };
  }

  function handleStart(sendResponse) {
    if (activeRun) {
      sendResponse({
        ok: false,
        error: "Coupon clipping is already running.",
      });
      return;
    }

    activeRun = clickCouponButtons()
      .then((result) => {
        sendResponse({
          ok: true,
          ...result,
        });
      })
      .catch((error) => {
        sendResponse({
          ok: false,
          error: error.message || "Could not clip coupons.",
        });
      })
      .finally(() => {
        activeRun = null;
      });
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== START_MESSAGE) {
      return false;
    }

    handleStart(sendResponse);
    return true;
  });
})();
