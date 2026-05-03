#!/usr/bin/env node
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

const WIDTH = 128;
const HEIGHT = 128;
const GREEN = [47, 125, 32, 255];
const WHITE = [255, 255, 255, 255];
const DARK_GREEN = [34, 100, 24, 255];

const FONT = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
};

function createCanvas(width, height, color) {
  const pixels = new Uint8Array(width * height * 4);

  for (let index = 0; index < pixels.length; index += 4) {
    pixels.set(color, index);
  }

  return pixels;
}

function setPixel(pixels, x, y, color) {
  if (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT) {
    return;
  }

  pixels.set(color, (y * WIDTH + x) * 4);
}

function fillRect(pixels, x, y, width, height, color) {
  for (let currentY = y; currentY < y + height; currentY += 1) {
    for (let currentX = x; currentX < x + width; currentX += 1) {
      setPixel(pixels, currentX, currentY, color);
    }
  }
}

function fillRoundedRect(pixels, x, y, width, height, radius, color) {
  for (let currentY = y; currentY < y + height; currentY += 1) {
    for (let currentX = x; currentX < x + width; currentX += 1) {
      const left = currentX - x;
      const right = x + width - 1 - currentX;
      const top = currentY - y;
      const bottom = y + height - 1 - currentY;
      const cornerX = Math.min(left, right);
      const cornerY = Math.min(top, bottom);

      if (cornerX >= radius || cornerY >= radius) {
        setPixel(pixels, currentX, currentY, color);
        continue;
      }

      const dx = radius - cornerX - 1;
      const dy = radius - cornerY - 1;

      if (dx * dx + dy * dy <= radius * radius) {
        setPixel(pixels, currentX, currentY, color);
      }
    }
  }
}

function drawText(pixels, text, x, y, scale, color) {
  let cursorX = x;

  for (const character of text.toUpperCase()) {
    if (character === " ") {
      cursorX += scale * 4;
      continue;
    }

    const glyph = FONT[character];

    if (!glyph) {
      cursorX += scale * 6;
      continue;
    }

    glyph.forEach((row, rowIndex) => {
      [...row].forEach((value, columnIndex) => {
        if (value !== "1") {
          return;
        }

        fillRect(
          pixels,
          cursorX + columnIndex * scale,
          y + rowIndex * scale,
          scale,
          scale,
          color
        );
      });
    });

    cursorX += scale * 6;
  }
}

function textWidth(text, scale) {
  return [...text.toUpperCase()].reduce((width, character) => {
    return width + scale * (character === " " ? 4 : 6);
  }, -scale);
}

function drawCenteredText(pixels, text, y, scale, color) {
  const x = Math.floor((WIDTH - textWidth(text, scale)) / 2);
  drawText(pixels, text, x, y, scale, color);
}

function makeCrcTable() {
  const table = [];

  for (let value = 0; value < 256; value += 1) {
    let crc = value;

    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }

    table[value] = crc >>> 0;
  }

  return table;
}

const CRC_TABLE = makeCrcTable();

function crc32(buffer) {
  let crc = 0xffffffff;

  for (const value of buffer) {
    crc = CRC_TABLE[(crc ^ value) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  const crc = Buffer.alloc(4);

  length.writeUInt32BE(data.length);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));

  return Buffer.concat([length, typeBuffer, data, crc]);
}

function pngFromRgba(width, height, pixels) {
  const header = Buffer.from([
    137, 80, 78, 71, 13, 10, 26, 10,
  ]);
  const ihdr = Buffer.alloc(13);
  const scanlines = Buffer.alloc(height * (1 + width * 4));

  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  for (let y = 0; y < height; y += 1) {
    const scanlineOffset = y * (1 + width * 4);
    scanlines[scanlineOffset] = 0;
    Buffer.from(pixels.subarray(y * width * 4, (y + 1) * width * 4)).copy(
      scanlines,
      scanlineOffset + 1
    );
  }

  return Buffer.concat([
    header,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(scanlines)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function drawIcon() {
  const pixels = createCanvas(WIDTH, HEIGHT, GREEN);

  fillRoundedRect(pixels, 13, 12, 102, 58, 10, WHITE);
  fillRoundedRect(pixels, 23, 25, 68, 7, 3, DARK_GREEN);
  fillRoundedRect(pixels, 23, 41, 68, 7, 3, DARK_GREEN);
  fillRoundedRect(pixels, 23, 57, 46, 7, 3, DARK_GREEN);
  fillRoundedRect(pixels, 103, 36, 23, 13, 6, GREEN);

  drawCenteredText(pixels, "COUPON", 80, 3, WHITE);
  drawCenteredText(pixels, "CLIPPER", 104, 3, WHITE);

  return pixels;
}

function resizeNearest(sourcePixels, sourceWidth, sourceHeight, targetSize) {
  const targetPixels = new Uint8Array(targetSize * targetSize * 4);

  for (let y = 0; y < targetSize; y += 1) {
    for (let x = 0; x < targetSize; x += 1) {
      const sourceX = Math.floor((x / targetSize) * sourceWidth);
      const sourceY = Math.floor((y / targetSize) * sourceHeight);
      const sourceOffset = (sourceY * sourceWidth + sourceX) * 4;
      const targetOffset = (y * targetSize + x) * 4;

      targetPixels.set(
        sourcePixels.subarray(sourceOffset, sourceOffset + 4),
        targetOffset
      );
    }
  }

  return targetPixels;
}

const sourcePixels = drawIcon();

for (const size of [16, 32, 48, 128]) {
  const pixels =
    size === WIDTH
      ? sourcePixels
      : resizeNearest(sourcePixels, WIDTH, HEIGHT, size);

  writeFileSync(`icons/icon-${size}.png`, pngFromRgba(size, size, pixels));
}
