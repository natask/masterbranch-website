/**
 * tailwind-resolver.mjs
 *
 * Resolves Tailwind text classes + root font sizes to pixel values
 * at each breakpoint. Pure math — no browser, no DOM.
 *
 * Usage:
 *   import { resolveTextSize, resolveContainerPadding } from './tailwind-resolver.mjs'
 */

// Tailwind v4 default text scale (rem values)
const TEXT_SCALE = {
  "text-xs": 0.75,
  "text-sm": 0.875,
  "text-base": 1,
  "text-lg": 1.125,
  "text-xl": 1.25,
  "text-2xl": 1.5,
  "text-3xl": 1.875,
  "text-4xl": 2.25,
  "text-5xl": 3,
  "text-6xl": 3.75,
  "text-7xl": 4.5,
  "text-8xl": 6,
  "text-9xl": 8,
};

// Tailwind v4 default spacing scale (rem values) for padding
const SPACING_SCALE = {
  "0": 0, "0.5": 0.125, "1": 0.25, "1.5": 0.375, "2": 0.5,
  "2.5": 0.625, "3": 0.75, "3.5": 0.875, "4": 1, "5": 1.25,
  "6": 1.5, "7": 1.75, "8": 2, "9": 2.25, "10": 2.5,
  "11": 2.75, "12": 3, "14": 3.5, "16": 4, "20": 5,
  "24": 6, "28": 7, "32": 8, "36": 9, "40": 10,
  "44": 11, "48": 12, "52": 13, "56": 14, "60": 15, "64": 16,
};

// Tailwind breakpoint minimums (px)
const TW_BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
};

// Root font sizes from globals.css
const ROOT_FONT_SIZES = [
  { minWidth: 0, rootSize: 18 },
  { minWidth: 640, rootSize: 22 },
  { minWidth: 1024, rootSize: 28 },
];

/**
 * Get root font size at a given viewport width.
 */
export function rootFontSizeAt(viewportWidth) {
  let size = ROOT_FONT_SIZES[0].rootSize;
  for (const rule of ROOT_FONT_SIZES) {
    if (viewportWidth >= rule.minWidth) size = rule.rootSize;
  }
  return size;
}

/**
 * Parse responsive Tailwind text classes from a className string.
 * Returns sorted breakpoint → rem pairs.
 *
 * Example: "text-6xl md:text-7xl lg:text-8xl"
 * → [{ minWidth: 0, rem: 3.75 }, { minWidth: 768, rem: 4.5 }, { minWidth: 1024, rem: 6 }]
 */
export function parseTextClasses(classString) {
  const classes = classString.split(/\s+/);
  const entries = [];

  for (const cls of classes) {
    const prefixMatch = cls.match(/^(\w+):(.+)$/);
    const prefix = prefixMatch ? prefixMatch[1] : null;
    const value = prefixMatch ? prefixMatch[2] : cls;

    if (TEXT_SCALE[value] !== undefined) {
      const minWidth = prefix ? (TW_BREAKPOINTS[prefix] || 0) : 0;
      entries.push({ minWidth, rem: TEXT_SCALE[value] });
    }
  }

  entries.sort((a, b) => a.minWidth - b.minWidth);
  return entries;
}

/**
 * Resolve text size to pixels at a given viewport width.
 *
 * Handles: Tailwind classes, clamp() values, or raw pixel strings.
 */
export function resolveTextSize(classStringOrStyle, viewportWidth) {
  // Handle clamp(min, preferred, max)
  if (typeof classStringOrStyle === "string" && classStringOrStyle.startsWith("clamp(")) {
    return resolveClamp(classStringOrStyle, viewportWidth);
  }

  // Handle raw pixel value
  if (typeof classStringOrStyle === "string" && classStringOrStyle.endsWith("px")) {
    return parseFloat(classStringOrStyle);
  }

  // Handle Tailwind classes
  const entries = parseTextClasses(classStringOrStyle);
  if (entries.length === 0) return null;

  // Find the active text class at this viewport width
  let activeRem = entries[0].rem;
  for (const e of entries) {
    if (viewportWidth >= e.minWidth) activeRem = e.rem;
  }

  const rootSize = rootFontSizeAt(viewportWidth);
  return activeRem * rootSize;
}

/**
 * Resolve clamp(min, preferred, max) at a viewport width.
 */
function resolveClamp(clampStr, viewportWidth) {
  const match = clampStr.match(/clamp\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^)]+)\s*\)/);
  if (!match) return null;

  const min = parseCSSValue(match[1].trim(), viewportWidth);
  const preferred = parseCSSValue(match[2].trim(), viewportWidth);
  const max = parseCSSValue(match[3].trim(), viewportWidth);

  return Math.min(Math.max(min, preferred), max);
}

/**
 * Parse a CSS value (px, vw, rem) to pixels.
 */
function parseCSSValue(value, viewportWidth) {
  if (value.endsWith("px")) return parseFloat(value);
  if (value.endsWith("vw")) return (parseFloat(value) / 100) * viewportWidth;
  if (value.endsWith("rem")) return parseFloat(value) * rootFontSizeAt(viewportWidth);
  return parseFloat(value);
}

/**
 * Parse padding class to horizontal padding in pixels.
 * Handles: px-6, p-4, etc.
 */
export function resolvePadding(classString, viewportWidth) {
  const classes = classString.split(/\s+/);
  let padRem = 0;

  for (const cls of classes) {
    const prefixMatch = cls.match(/^(\w+):(.+)$/);
    const prefix = prefixMatch ? prefixMatch[1] : null;
    const value = prefixMatch ? prefixMatch[2] : cls;

    // Only apply if viewport matches prefix
    if (prefix && TW_BREAKPOINTS[prefix] && viewportWidth < TW_BREAKPOINTS[prefix]) continue;

    const padMatch = value.match(/^p[xy]?-(\d+(?:\.\d+)?)$/);
    if (padMatch && (value.startsWith("px-") || value.startsWith("p-"))) {
      const key = padMatch[1];
      if (SPACING_SCALE[key] !== undefined) padRem = SPACING_SCALE[key];
    }
  }

  // px- is horizontal padding on both sides
  const rootSize = rootFontSizeAt(viewportWidth);
  return padRem * rootSize * 2;
}
