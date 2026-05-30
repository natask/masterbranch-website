#!/usr/bin/env node
/**
 * Trace the transparent PNG icon into SVG paths.
 *
 * Usage:
 *   node scripts/trace-icon.mjs
 *   node scripts/trace-icon.mjs public/icon.png public/icon.svg
 */

import { writeFile } from "fs/promises";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import ImageTracer from "imagetracerjs";
import sharp from "sharp";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_INPUT = "public/icon.png";
const DEFAULT_OUTPUT = "public/icon.svg";

const args = process.argv.slice(2);
const inputPath = resolve(ROOT, args[0] ?? DEFAULT_INPUT);
const outputPath = resolve(ROOT, args[1] ?? DEFAULT_OUTPUT);

const { data, info } = await sharp(inputPath)
  .ensureAlpha()
  .resize(512, 512, {
    fit: "contain",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .raw()
  .toBuffer({ resolveWithObject: true });

const svg = ImageTracer.imagedataToSVG(
  {
    width: info.width,
    height: info.height,
    data: new Uint8ClampedArray(data),
  },
  {
    colorsampling: 2,
    ltres: 1,
    numberofcolors: 24,
    pathomit: 8,
    qtres: 1,
    scale: 1,
    viewbox: true,
  },
);

await writeFile(outputPath, `${svg}\n`);

console.log(`Traced ${inputPath}`);
console.log(`Wrote ${outputPath}`);
