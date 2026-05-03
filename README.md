# Coupon Clipper Extension

A personal browser extension to help clip visible digital coupons and card-linked
offers.

This project is personal and is not affiliated with, endorsed by, or sponsored by
BJ's Wholesale Club or any other retailer.

## Goals

- Run only on supported coupon pages.
- Use the existing browser session.
- Click visible coupon buttons slowly and transparently.
- Avoid storing credentials or sensitive account data.

## Status

Experimental personal project.

## Usage

1. Open a supported coupon or offers page.
2. Open the extension popup and click **Start**.

The extension scans down the page and clicks visible enabled controls that look
like coupon clipping actions, including BJ's `+ Clip to Card` buttons and Amex
`Add to Card` buttons.

If the popup is opened on another supported site page, the button opens that
site's configured coupons or offers page. On unsupported pages, the button is
disabled.

## Supported Sites

- BJ's coupons: `https://www.bjs.com/myCoupons`
- Amex Offers: `https://global.americanexpress.com/dashboard`

See [Adding Supported Sites](docs/adding-sites.md) for the checklist used to add
future sites.

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

## Automated builds

GitHub Actions builds Chrome and Firefox packages on every push, pull request,
and manual workflow run. These builds appear on the workflow run as downloadable
artifacts.

The generated artifacts are:

```text
coupon-clipper-extension-chrome.zip
coupon-clipper-extension-firefox.zip
```

To create a GitHub Release, push a version tag:

```sh
git tag v0.1.0
git push origin v0.1.0
```

The release workflow builds both packages and attaches them to the release.
