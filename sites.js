(() => {
  const SITES = [
    {
      id: "bjs",
      displayName: "BJ's",
      startUrl: "https://www.bjs.com/myCoupons",
      hosts: ["www.bjs.com"],
      couponPathPattern: /^\/mycoupons\/?$/i,
      popup: {
        openLabel: "Open Coupons",
        startLabel: "Start",
      },
      content: {
        clickDelayMs: 1200,
        scrollDelayMs: 1400,
        maxScanPasses: 80,
        maxNoProgressPasses: 4,
        controlSelector:
          "button, [role='button'], a[href], input[type='button'], input[type='submit']",
        clipPatterns: [
          /\+?\s*clip to card\b/i,
          /\bclip\b/i,
          /\bclip coupon\b/i,
          /\badd coupon\b/i,
          /\badd to card\b/i,
          /\bactivate coupon\b/i,
          /\bload to card\b/i,
        ],
        excludedPatterns: [
          /\bclipped\b/i,
          /\bunclip\b/i,
          /\bremove\b/i,
          /\bdetails?\b/i,
          /\blearn more\b/i,
          /\bview\b/i,
        ],
        cardSelector:
          "article, li, section, [class*='coupon' i], [data-testid*='coupon' i], [data-test-id*='coupon' i]",
        clippedStatePatterns: [
          /✓\s*clipped\b/i,
          /\bclipped\b/i,
          /\balready clipped\b/i,
        ],
      },
    },
    {
      id: "amex",
      displayName: "Amex",
      startUrl: "https://global.americanexpress.com/dashboard",
      hosts: ["global.americanexpress.com"],
      couponPathPattern: /^\/dashboard\/?$/i,
      popup: {
        openLabel: "Open Offers",
        startLabel: "Start",
      },
      content: {
        clickDelayMs: 1500,
        scrollDelayMs: 1600,
        maxScanPasses: 100,
        maxNoProgressPasses: 5,
        controlSelector:
          "button, [role='button'], a[href], input[type='button'], input[type='submit']",
        clipPatterns: [
          /^add to card\b/i,
          /\badd to card\b/i,
        ],
        excludedPatterns: [
          /\badded\b/i,
          /\badded to card\b/i,
          /\brefer now\b/i,
          /\bview offer\b/i,
          /\blearn more\b/i,
          /\bexplore now\b/i,
          /\bview all\b/i,
          /\bprogram terms\b/i,
          /\bfrequently asked questions\b/i,
        ],
        cardSelector:
          "article, li, [role='listitem'], [class*='offer' i], [data-testid*='offer' i], [data-test-id*='offer' i]",
        clippedStatePatterns: [
          /\badded\b/i,
          /\badded to card\b/i,
          /\boffer added\b/i,
        ],
      },
    },
  ];

  function parseUrl(url) {
    try {
      return new URL(url);
    } catch {
      return null;
    }
  }

  function normalizePathname(pathname) {
    return pathname.replace(/\/+$/, "") || "/";
  }

  function findSiteByUrl(url) {
    const parsedUrl = parseUrl(url);

    if (!parsedUrl || parsedUrl.protocol !== "https:") {
      return null;
    }

    return (
      SITES.find((site) => site.hosts.includes(parsedUrl.hostname)) || null
    );
  }

  function isCouponPage(site, url) {
    const parsedUrl = parseUrl(url);

    if (!site || !parsedUrl) {
      return false;
    }

    return site.couponPathPattern.test(normalizePathname(parsedUrl.pathname));
  }

  globalThis.CouponClipperSites = {
    all: SITES,
    findSiteByUrl,
    isCouponPage,
  };
})();
