(() => {
  if (globalThis.__couponClipperContentScriptLoaded) {
    return;
  }

  const site = globalThis.CouponClipperSites?.findSiteByUrl(
    window.location.href
  );
  const contentConfig = site?.content;

  if (!contentConfig) {
    return;
  }

  globalThis.__couponClipperContentScriptLoaded = true;

  const START_MESSAGE = "couponClipper:start";
  const CLICK_DELAY_MS = contentConfig.clickDelayMs;
  const SCROLL_DELAY_MS = contentConfig.scrollDelayMs;
  const MAX_SCAN_PASSES = contentConfig.maxScanPasses;
  const MAX_NO_PROGRESS_PASSES = contentConfig.maxNoProgressPasses;
  const CONTROL_SELECTOR = contentConfig.controlSelector;
  const CLIP_PATTERNS = contentConfig.clipPatterns;
  const CARD_SCOPED_CLIP_PATTERNS =
    contentConfig.cardScopedClipPatterns || [];
  const EXCLUDED_PATTERNS = contentConfig.excludedPatterns;
  const CARD_SELECTOR = contentConfig.cardSelector;
  const CLIPPED_STATE_PATTERNS = contentConfig.clippedStatePatterns;
  const REQUIRED_CARD_PATTERNS = contentConfig.requiredCardPatterns || [];
  const EXPAND_CARD_TO_REQUIRED_TEXT =
    contentConfig.expandCardToRequiredText || false;
  const ICON_ONLY_CLIP_BUTTONS = contentConfig.iconOnlyClipButtons || false;
  const ICON_BUTTON_MIN_SIZE = contentConfig.iconButtonMinSize || 24;
  const ICON_BUTTON_MAX_SIZE = contentConfig.iconButtonMaxSize || 96;
  const ICON_BUTTON_MIN_CARD_X_RATIO =
    contentConfig.iconButtonMinCardXRatio || 0.72;
  const CLIPPED_CONTROL_PATTERNS =
    contentConfig.clippedControlPatterns || [];

  let activeRun = null;
  let clickedSignatures = new Set();

  function delay(ms) {
    return new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });
  }

  function getClassLabel(element) {
    if (typeof element.className === "string") {
      return element.className;
    }

    if (typeof element.className?.baseVal === "string") {
      return element.className.baseVal;
    }

    return "";
  }

  function getOwnLabelParts(element) {
    return [
      element.textContent,
      element.getAttribute("aria-label"),
      element.getAttribute("title"),
      element.getAttribute("alt"),
      element.getAttribute("value"),
      element.getAttribute("data-testid"),
      element.getAttribute("data-test-id"),
      element.getAttribute("data-icon"),
      element.getAttribute("href"),
      element.getAttribute("xlink:href"),
      element.id,
      getClassLabel(element),
    ];
  }

  function getDescendantLabelParts(element) {
    if (!element.querySelectorAll) {
      return [];
    }

    return Array.from(
      element.querySelectorAll(
        "[aria-label], [title], [alt], [data-testid], [data-test-id], [data-icon], svg, use"
      )
    )
      .slice(0, 40)
      .flatMap((descendant) => getOwnLabelParts(descendant));
  }

  function getElementLabel(element) {
    return getOwnLabelParts(element)
      .concat(getDescendantLabelParts(element))
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

  function getScrollTop() {
    return (
      window.scrollY ||
      document.documentElement.scrollTop ||
      document.body.scrollTop ||
      0
    );
  }

  function getDocumentHeight() {
    return Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight,
      document.body.offsetHeight,
      document.documentElement.offsetHeight
    );
  }

  function getViewportHeight() {
    return window.innerHeight || document.documentElement.clientHeight;
  }

  function isNearPageBottom() {
    return getScrollTop() + getViewportHeight() >= getDocumentHeight() - 8;
  }

  function scrollToNextViewport() {
    const previousScrollTop = getScrollTop();
    const scrollDistance = Math.max(Math.floor(getViewportHeight() * 0.85), 320);

    window.scrollBy({
      top: scrollDistance,
      left: 0,
      behavior: "smooth",
    });

    return previousScrollTop;
  }

  function getElementSignature(element) {
    const rect = element.getBoundingClientRect();
    const documentTop = Math.round(rect.top + getScrollTop());
    const documentLeft = Math.round(rect.left + window.scrollX);

    return [
      getElementLabel(element).toLowerCase(),
      documentTop,
      documentLeft,
      Math.round(rect.width),
      Math.round(rect.height),
    ].join("|");
  }

  function getCouponCard(element) {
    const card = element.closest(CARD_SELECTOR);

    if (!card || !EXPAND_CARD_TO_REQUIRED_TEXT) {
      return card;
    }

    let current = card;

    while (current && current !== document.body) {
      const label = getElementLabel(current);

      if (REQUIRED_CARD_PATTERNS.every((pattern) => pattern.test(label))) {
        return current;
      }

      current = current.parentElement;
    }

    return card;
  }

  function parseRgbColor(value) {
    if (!value || value === "transparent") {
      return null;
    }

    const match = value.match(
      /rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)(?:\s*,\s*(\d+(?:\.\d+)?))?\s*\)/i
    );

    if (!match) {
      return null;
    }

    const alpha = match[4] === undefined ? 1 : Number(match[4]);

    if (alpha === 0) {
      return null;
    }

    return {
      r: Number(match[1]),
      g: Number(match[2]),
      b: Number(match[3]),
    };
  }

  function getColorSamples(element) {
    const nodes = [element];

    if (element.querySelectorAll) {
      nodes.push(
        ...Array.from(
          element.querySelectorAll("svg, path, circle, rect, line, polyline, use")
        ).slice(0, 20)
      );
    }

    return nodes.flatMap((node) => {
      const style = window.getComputedStyle(node);

      return [
        style.backgroundColor,
        style.color,
        style.borderColor,
        style.fill,
        style.stroke,
      ]
        .map(parseRgbColor)
        .filter(Boolean);
    });
  }

  function isBlueishColor(color) {
    return color.b >= 120 && color.b > color.r + 45 && color.b >= color.g;
  }

  function isGreenishColor(color) {
    return color.g >= 90 && color.g > color.r + 25 && color.g > color.b + 10;
  }

  function hasBlueishStyle(element) {
    return getColorSamples(element).some(isBlueishColor);
  }

  function hasGreenishStyle(element) {
    return getColorSamples(element).some(isGreenishColor);
  }

  function looksLikeClippedControl(element) {
    const label = getElementLabel(element);

    return (
      CLIPPED_CONTROL_PATTERNS.some((pattern) => pattern.test(label)) ||
      hasGreenishStyle(element)
    );
  }

  function isInsideClippedCouponCard(element) {
    const card = getCouponCard(element);

    if (!card) {
      return false;
    }

    const cardLabel = getElementLabel(card);

    return CLIPPED_STATE_PATTERNS.some((pattern) => pattern.test(cardLabel));
  }

  function isInsideRequiredCouponCard(element) {
    if (REQUIRED_CARD_PATTERNS.length === 0) {
      return true;
    }

    const card = getCouponCard(element);

    if (!card) {
      return false;
    }

    const cardLabel = getElementLabel(card);

    return REQUIRED_CARD_PATTERNS.every((pattern) => pattern.test(cardLabel));
  }

  function isSquareishIconButton(element) {
    const rect = element.getBoundingClientRect();
    const largestSide = Math.max(rect.width, rect.height);
    const smallestSide = Math.min(rect.width, rect.height);

    return (
      smallestSide >= ICON_BUTTON_MIN_SIZE &&
      largestSide <= ICON_BUTTON_MAX_SIZE &&
      largestSide / smallestSide <= 1.5
    );
  }

  function isInCardActionArea(element) {
    const card = getCouponCard(element);

    if (!card) {
      return false;
    }

    const rect = element.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const elementCenterX = rect.left + rect.width / 2;
    const actionAreaStart =
      cardRect.left + cardRect.width * ICON_BUTTON_MIN_CARD_X_RATIO;

    return elementCenterX >= actionAreaStart;
  }

  function looksLikeIconOnlyClipAction(element) {
    return (
      ICON_ONLY_CLIP_BUTTONS &&
      isInsideRequiredCouponCard(element) &&
      isSquareishIconButton(element) &&
      isInCardActionArea(element) &&
      hasBlueishStyle(element) &&
      !looksLikeClippedControl(element)
    );
  }

  function looksLikeClipAction(element) {
    const label = getElementLabel(element);

    if (label && EXCLUDED_PATTERNS.some((pattern) => pattern.test(label))) {
      return false;
    }

    if (CLIP_PATTERNS.some((pattern) => pattern.test(label))) {
      return true;
    }

    return (
      (CARD_SCOPED_CLIP_PATTERNS.some((pattern) => pattern.test(label)) &&
        isInsideRequiredCouponCard(element)) ||
      looksLikeIconOnlyClipAction(element)
    );
  }

  function findVisibleCouponButtons() {
    return Array.from(document.querySelectorAll(CONTROL_SELECTOR)).filter(
      (element) => {
        return (
          !isDisabled(element) &&
          isVisible(element) &&
          isInViewport(element) &&
          looksLikeClipAction(element) &&
          !looksLikeClippedControl(element) &&
          !isInsideClippedCouponCard(element) &&
          !clickedSignatures.has(getElementSignature(element))
        );
      }
    );
  }

  async function clickVisibleCouponButtons() {
    const buttons = findVisibleCouponButtons();
    let clickedCount = 0;
    let failedCount = 0;

    for (const button of buttons) {
      if (!button.isConnected || isDisabled(button) || !isVisible(button)) {
        continue;
      }

      try {
        clickedSignatures.add(getElementSignature(button));
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

  async function clickCouponButtons() {
    const startingScrollTop = getScrollTop();
    let clickedCount = 0;
    let failedCount = 0;
    let scannedPasses = 0;
    let noProgressPasses = 0;

    clickedSignatures = new Set();

    while (scannedPasses < MAX_SCAN_PASSES) {
      const beforeScrollTop = getScrollTop();
      const result = await clickVisibleCouponButtons();

      scannedPasses += 1;
      clickedCount += result.clickedCount;
      failedCount += result.failedCount;

      if (result.clickedCount > 0) {
        noProgressPasses = 0;
      } else {
        noProgressPasses += 1;
      }

      if (isNearPageBottom() && noProgressPasses >= 1) {
        break;
      }

      if (noProgressPasses >= MAX_NO_PROGRESS_PASSES) {
        break;
      }

      scrollToNextViewport();
      await delay(SCROLL_DELAY_MS);

      if (Math.abs(getScrollTop() - beforeScrollTop) < 4 && isNearPageBottom()) {
        break;
      }
    }

    return {
      clickedCount,
      failedCount,
      scannedPasses,
      reachedBottom: isNearPageBottom(),
      startingScrollTop,
      endingScrollTop: getScrollTop(),
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
