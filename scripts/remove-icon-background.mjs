#!/usr/bin/env node
/**
 * Make the black background of the icon transparent.
 *
 * Usage:
 *   node scripts/remove-icon-background.mjs
 *   node scripts/remove-icon-background.mjs ../design_references/crown_tree_circuit_emblem_black public/icon.png
 *   node scripts/remove-icon-background.mjs --threshold=34 input.png output.png
 */

import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_INPUT = "../design_references/crown_tree_circuit_emblem_black";
const DEFAULT_OUTPUT = "public/icon.png";
const DEFAULT_THRESHOLD = 30;
const DEFAULT_OUTPUT_SIZE = 512;
const DEFAULT_PADDING_RATIO = 0.07;

const args = process.argv.slice(2);
const positional = args.filter((arg) => !arg.startsWith("--"));
const thresholdArg = args.find((arg) => arg.startsWith("--threshold="));
const threshold = thresholdArg
  ? Number.parseInt(thresholdArg.split("=")[1] ?? "", 10)
  : DEFAULT_THRESHOLD;

if (!Number.isInteger(threshold) || threshold < 0 || threshold > 255) {
  throw new Error("--threshold must be an integer from 0 to 255");
}

const inputPath = resolve(ROOT, positional[0] ?? DEFAULT_INPUT);
const outputPath = resolve(ROOT, positional[1] ?? DEFAULT_OUTPUT);

const image = sharp(inputPath).ensureAlpha();
const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });

let transparentPixels = 0;
let minX = info.width;
let minY = info.height;
let maxX = 0;
let maxY = 0;

for (let offset = 0; offset < data.length; offset += info.channels) {
  const pixel = offset / info.channels;
  const x = pixel % info.width;
  const y = Math.floor(pixel / info.width);
  const red = data[offset];
  const green = data[offset + 1];
  const blue = data[offset + 2];
  const brightness = Math.max(red, green, blue);

  if (brightness <= threshold) {
    data[offset + 3] = 0;
    transparentPixels += 1;
  } else {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
}

if (maxX < minX || maxY < minY) {
  throw new Error(`No visible pixels remain after applying threshold ${threshold}`);
}

const visibleWidth = maxX - minX + 1;
const visibleHeight = maxY - minY + 1;
const padding = Math.round(Math.max(visibleWidth, visibleHeight) * DEFAULT_PADDING_RATIO);
const left = Math.max(0, minX - padding);
const top = Math.max(0, minY - padding);
const width = Math.min(info.width - left, visibleWidth + padding * 2);
const height = Math.min(info.height - top, visibleHeight + padding * 2);

await sharp(data, {
  raw: {
    width: info.width,
    height: info.height,
    channels: info.channels,
  },
})
  .extract({ left, top, width, height })
  .resize(DEFAULT_OUTPUT_SIZE, DEFAULT_OUTPUT_SIZE, {
    fit: "contain",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png()
  .toFile(outputPath);

console.log(`Made ${transparentPixels.toLocaleString()} black pixels transparent`);
console.log(`Wrote ${outputPath}`);
