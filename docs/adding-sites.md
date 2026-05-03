# Adding Supported Sites

Each supported site lives in `sites.js`. The popup and content script both read
from that registry, so adding a site should usually be a configuration change
plus manifest host permissions.

## Site Checklist

1. Identify the coupon or offers page URL.
2. Identify the hostnames the extension needs to run on.
3. Capture the unclaimed offer button text.
4. Capture the already-claimed offer state text.
5. Add the host to both manifests.
6. Add a site entry to `sites.js`.
7. Build and test locally before opening a pull request.

## Config Fields

Add an object to the `SITES` array in `sites.js`:

```js
{
  id: "example",
  displayName: "Example",
  startUrl: "https://www.example.com/offers",
  hosts: ["www.example.com"],
  couponPathPattern: /^\/offers\/?$/i,
  popup: {
    openLabel: "Open Offers",
    startLabel: "Start",
  },
  content: {
    clickDelayMs: 1200,
    scrollDelayMs: 1400,
    maxScanPasses: 80,
    maxNoProgressPasses: 4,
    controlSelector: "button, [role='button']",
    clipPatterns: [/\badd to card\b/i],
    excludedPatterns: [/\badded\b/i, /\bdetails?\b/i],
    cardSelector: "article, li, section",
    clippedStatePatterns: [/\badded\b/i],
  },
}
```

## Manifest Fields

Update both `manifest.json` and `manifest.firefox.json`:

```json
"host_permissions": [
  "https://www.bjs.com/*",
  "https://www.example.com/*"
],
"content_scripts": [
  {
    "matches": [
      "https://www.bjs.com/*",
      "https://www.example.com/*"
    ],
    "js": ["sites.js", "content.js"],
    "run_at": "document_idle"
  }
]
```

## Local Validation

Run:

```sh
node --check sites.js
node --check popup.js
node --check content.js
python3 -m json.tool manifest.json
python3 -m json.tool manifest.firefox.json
./scripts/build-chrome-extension.sh
./scripts/build-firefox-addon.sh
npx --yes web-ext lint --source-dir=dist/firefox-addon
```

Then load the unpacked extension from `dist/chrome-extension` or
`dist/firefox-addon` and test against the real site.

## Amex Notes

Amex Offers are configured for:

- Dashboard preview URL: `https://global.americanexpress.com/dashboard`
- Full offers URL: `https://global.americanexpress.com/offers/eligible`
- Host: `global.americanexpress.com`
- Action buttons: `Add to Card` in the dashboard preview, and `+` in full
  offers rows/cards that contain `View Details`
- Ignored buttons: `Refer Now`, `View Details`, `View Offer`, `Learn More`,
  `Explore Now`, and `View All`
- The dashboard may show only a short offers preview. Use the full offers page
  before scanning.

Do not store credentials, account data, offer details, or card data in the
extension.
