#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="$ROOT_DIR/dist/chrome-extension"
ZIP_FILE="$ROOT_DIR/dist/coupon-clipper-extension-chrome.zip"

rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

cp "$ROOT_DIR/manifest.json" "$BUILD_DIR/manifest.json"
cp "$ROOT_DIR/content.js" "$BUILD_DIR/content.js"
cp "$ROOT_DIR/popup.css" "$BUILD_DIR/popup.css"
cp "$ROOT_DIR/popup.html" "$BUILD_DIR/popup.html"
cp "$ROOT_DIR/popup.js" "$BUILD_DIR/popup.js"
cp "$ROOT_DIR/LICENSE" "$BUILD_DIR/LICENSE"

rm -f "$ZIP_FILE"
(
  cd "$BUILD_DIR"
  zip -qr "$ZIP_FILE" .
)

echo "Built $ZIP_FILE"
echo "Unpacked Chrome extension files are in $BUILD_DIR"
