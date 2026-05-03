# Coupon Clipper Extension

A personal browser extension to help clip visible digital coupons from a membership
coupon page.

This project is personal and is not affiliated with, endorsed by, or sponsored by
BJ's Wholesale Club or any other retailer.

## Goals

- Run only on supported coupon pages.
- Use the existing browser session.
- Click visible coupon buttons slowly and transparently.
- Avoid storing credentials or sensitive account data.

## Status

Experimental personal project.

## Chrome local development

1. Open Chrome and go to `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this repository folder.

## Firefox local development

Firefox uses `manifest.firefox.json`, which adds Firefox-specific add-on metadata.
Build the Firefox development folder first:

```sh
./scripts/build-firefox-addon.sh
```

Then load it in Firefox:

1. Open Firefox and go to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on...**.
3. Select `dist/firefox-addon/manifest.json`.

## Firefox add-on package

Create the package with:

```sh
./scripts/build-firefox-addon.sh
```

The generated file is:

```text
dist/coupon-clipper-extension-firefox.zip
```

Submit that ZIP to Mozilla Add-ons for signing before distributing it to other
Firefox users.

## Repository

Intended GitHub remote:

```text
https://github.com/kamleshkc2002/coupon-clipper-extension
```
