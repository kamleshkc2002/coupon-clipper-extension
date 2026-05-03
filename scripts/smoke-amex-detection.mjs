import { readFileSync } from "node:fs";
import vm from "node:vm";

class FakeElement {
  constructor({
    name = "div",
    text = "",
    attrs = {},
    parent = null,
    rect = {},
    style = {},
  } = {}) {
    this.name = name;
    this.textContent = text;
    this.attrs = attrs;
    this.parentElement = parent;
    this.children = [];
    this.disabled = false;
    this.id = attrs.id || "";
    this.className = attrs.class || "";
    this.isConnected = true;
    this.clicked = 0;
    this.rect = {
      top: 20,
      left: 20,
      right: 80,
      bottom: 80,
      width: 60,
      height: 60,
      ...rect,
    };
    this.style = {
      display: "block",
      visibility: "visible",
      opacity: "1",
      pointerEvents: "auto",
      backgroundColor: "rgba(0, 0, 0, 0)",
      color: "rgb(0, 0, 0)",
      borderColor: "rgba(0, 0, 0, 0)",
      fill: "rgba(0, 0, 0, 0)",
      stroke: "rgba(0, 0, 0, 0)",
      ...style,
    };

    if (parent) {
      parent.children.push(this);
    }
  }

  getAttribute(name) {
    return this.attrs[name] || null;
  }

  matches(selector) {
    if (selector.includes("[disabled]") || selector.includes("aria-disabled")) {
      return this.disabled || this.attrs["aria-disabled"] === "true";
    }

    return true;
  }

  closest(selector) {
    let current = this;

    while (current) {
      if (selector === "[aria-disabled='true']") {
        if (current.attrs["aria-disabled"] === "true") {
          return current;
        }
      } else if (
        ["article", "li", "section", "div"].includes(current.name) ||
        current.attrs.role === "listitem" ||
        /offer|coupon/i.test(current.className)
      ) {
        return current;
      }

      current = current.parentElement;
    }

    return null;
  }

  querySelectorAll() {
    return this.children.flatMap((child) => [child, ...child.querySelectorAll()]);
  }

  getClientRects() {
    return [this.rect];
  }

  getBoundingClientRect() {
    return this.rect;
  }

  click() {
    this.clicked += 1;
  }
}

function makeContext(controls) {
  let listener;

  const body = new FakeElement({
    name: "body",
    rect: { top: 0, left: 0, right: 1600, bottom: 900, width: 1600, height: 900 },
  });

  const context = {
    URL,
    console,
    setTimeout,
    clearTimeout,
    window: {
      location: {
        href: "https://global.americanexpress.com/offers/eligible",
      },
      innerWidth: 1600,
      innerHeight: 900,
      scrollX: 0,
      scrollY: 0,
      setTimeout,
      scrollBy({ top }) {
        this.scrollY += top;
      },
      getComputedStyle(element) {
        return element.style;
      },
    },
    document: {
      body,
      documentElement: {
        scrollTop: 0,
        scrollHeight: 900,
        offsetHeight: 900,
        clientHeight: 900,
      },
      querySelectorAll() {
        return controls;
      },
    },
    chrome: {
      runtime: {
        onMessage: {
          addListener(callback) {
            listener = callback;
          },
        },
      },
    },
  };

  context.globalThis = context;

  return { body, context, getListener: () => listener };
}

function addIcon(parent, className) {
  return new FakeElement({
    name: "svg",
    attrs: { class: className },
    parent,
    style: { color: "rgb(255, 255, 255)" },
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function run() {
  const controls = [];
  const { body, context, getListener } = makeContext(controls);

  const liveOffer = new FakeElement({
    name: "div",
    text: "Omni Hotels & Resorts Spend $500 or more View Details Terms apply",
    parent: body,
    rect: { top: 100, left: 100, right: 1500, bottom: 240, width: 1400, height: 140 },
  });
  const iconOnlyAddButton = new FakeElement({
    name: "button",
    parent: liveOffer,
    rect: { top: 145, left: 1390, right: 1450, bottom: 205, width: 60, height: 60 },
    style: {
      backgroundColor: "rgb(0, 111, 207)",
      color: "rgb(255, 255, 255)",
    },
  });
  addIcon(iconOnlyAddButton, "dls-icon-plus");
  controls.push(iconOnlyAddButton);

  const clippedOffer = new FakeElement({
    name: "div",
    text: "AT&T Wireless Spend $65 or more View Details Terms apply",
    parent: body,
    rect: { top: 260, left: 100, right: 1500, bottom: 400, width: 1400, height: 140 },
  });
  const greenCheckButton = new FakeElement({
    name: "button",
    parent: clippedOffer,
    rect: { top: 305, left: 1390, right: 1450, bottom: 365, width: 60, height: 60 },
    style: {
      backgroundColor: "rgb(53, 128, 77)",
      color: "rgb(255, 255, 255)",
    },
  });
  addIcon(greenCheckButton, "dls-icon-check");
  controls.push(greenCheckButton);

  const detailsLink = new FakeElement({
    name: "a",
    text: "View Details",
    parent: liveOffer,
    rect: { top: 160, left: 1270, right: 1370, bottom: 190, width: 100, height: 30 },
    style: { color: "rgb(0, 111, 207)" },
  });
  controls.push(detailsLink);

  const referralRow = new FakeElement({
    name: "div",
    text: "Your Referral Offer Earn 20,000 bonus miles Refer Now",
    parent: body,
    rect: { top: 420, left: 100, right: 1500, bottom: 560, width: 1400, height: 140 },
  });
  const referralButton = new FakeElement({
    name: "button",
    text: "Refer Now",
    parent: referralRow,
    rect: { top: 465, left: 1310, right: 1450, bottom: 515, width: 140, height: 50 },
    style: { color: "rgb(0, 111, 207)" },
  });
  controls.push(referralButton);

  const dashboardOffer = new FakeElement({
    name: "div",
    text: "SentrySafe Earn 10% back on purchases",
    parent: body,
    rect: { top: 580, left: 100, right: 1500, bottom: 720, width: 1400, height: 140 },
  });
  const addToCardButton = new FakeElement({
    name: "button",
    text: "Add to Card",
    parent: dashboardOffer,
    rect: { top: 625, left: 1300, right: 1450, bottom: 675, width: 150, height: 50 },
  });
  controls.push(addToCardButton);

  vm.createContext(context);
  vm.runInContext(
    readFileSync(new URL("../sites.js", import.meta.url), "utf8"),
    context
  );

  const amex = context.CouponClipperSites.all.find((site) => site.id === "amex");
  amex.content.clickDelayMs = 0;
  amex.content.scrollDelayMs = 0;
  amex.content.maxScanPasses = 1;

  vm.runInContext(
    readFileSync(new URL("../content.js", import.meta.url), "utf8"),
    context
  );

  const listener = getListener();

  await new Promise((resolve, reject) => {
    const keepAlive = listener(
      { type: "couponClipper:start" },
      {},
      (result) => {
        try {
          assert(keepAlive, "listener did not keep the response channel open");
          assert(result.ok, result.error || "clipping run failed");
          assert(result.clickedCount === 2, `expected 2 clicks, got ${result.clickedCount}`);
          assert(iconOnlyAddButton.clicked === 1, "icon-only add button was not clicked");
          assert(addToCardButton.clicked === 1, "Add to Card button was not clicked");
          assert(greenCheckButton.clicked === 0, "green check button was clicked");
          assert(detailsLink.clicked === 0, "View Details link was clicked");
          assert(referralButton.clicked === 0, "Referral button was clicked");
          resolve();
        } catch (error) {
          reject(error);
        }
      }
    );
  });

  console.log("Amex detection smoke test passed.");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
