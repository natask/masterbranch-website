import { readFileSync } from "fs";
import { resolve } from "path";
import { resolvePadding, resolveTextSize } from "./tailwind-resolver.mjs";

export function loadConfig(configPath) {
  return JSON.parse(readFileSync(resolve(configPath), "utf-8"));
}

export function resolveContainerWidth(check, bp, horizontalPadding) {
  let containerWidth = bp.width - horizontalPadding;

  if (typeof check.maxViewportWidth === "number") {
    containerWidth = Math.min(containerWidth, check.maxViewportWidth - horizontalPadding);
  }

  if (typeof check.maxContainerWidth === "number") {
    containerWidth = Math.min(containerWidth, check.maxContainerWidth);
  }

  if (typeof check.containerFraction === "number") {
    containerWidth *= check.containerFraction;
  }

  if (typeof check.reservedWidth === "number") {
    containerWidth -= check.reservedWidth;
  }

  return Math.max(0, Math.round(Math.min(containerWidth, bp.width)));
}

export function resolveEffectiveText(check, bp) {
  if (typeof check.hiddenBelowWidth === "number" && bp.width < check.hiddenBelowWidth) return "";
  if (typeof check.hiddenAtOrBelowWidth === "number" && bp.width <= check.hiddenAtOrBelowWidth) return "";
  if (typeof check.hiddenAboveWidth === "number" && bp.width > check.hiddenAboveWidth) return "";
  if (typeof check.hiddenAtOrAboveWidth === "number" && bp.width >= check.hiddenAtOrAboveWidth) return "";

  if (check.textByBreakpoint && typeof check.textByBreakpoint === "object") {
    if (Object.hasOwn(check.textByBreakpoint, bp.name)) return check.textByBreakpoint[bp.name] ?? "";
  }

  if (Array.isArray(check.textRules)) {
    for (const rule of check.textRules) {
      const nameOk = !rule.breakpoint || rule.breakpoint === bp.name;
      const minOk = typeof rule.minWidth !== "number" || bp.width >= rule.minWidth;
      const maxOk = typeof rule.maxWidth !== "number" || bp.width <= rule.maxWidth;
      if (nameOk && minOk && maxOk) return rule.text ?? "";
    }
  }

  return check.text || "";
}

export function resolveEffectiveSelector(check, bp) {
  if (check.selectorByBreakpoint && typeof check.selectorByBreakpoint === "object") {
    if (Object.hasOwn(check.selectorByBreakpoint, bp.name)) return check.selectorByBreakpoint[bp.name] || null;
  }

  if (Array.isArray(check.selectorRules)) {
    for (const rule of check.selectorRules) {
      const nameOk = !rule.breakpoint || rule.breakpoint === bp.name;
      const minOk = typeof rule.minWidth !== "number" || bp.width >= rule.minWidth;
      const maxOk = typeof rule.maxWidth !== "number" || bp.width <= rule.maxWidth;
      if (nameOk && minOk && maxOk) return rule.selector || null;
    }
  }

  return check.selector || null;
}

export function resolveCheck(check, breakpoints) {
  return breakpoints.map(bp => {
    let fontSize;

    if (check.classes) {
      fontSize = resolveTextSize(check.classes, bp.width);
    } else if (check.inlineStyle) {
      fontSize = resolveTextSize(check.inlineStyle, bp.width);
    } else if (check.responsive) {
      let fs = check.fontSize;
      for (const option of check.responsive) {
        if (bp.width >= option.minWidth) fs = option.fontSize;
      }
      fontSize = parseFloat(fs);
    } else {
      fontSize = parseFloat(check.fontSize);
    }

    let horizontalPadding;
    if (check.containerPadding) {
      horizontalPadding = resolvePadding(check.containerPadding, bp.width);
    } else {
      horizontalPadding = check.horizontalPadding || 48;
    }

    return {
      breakpoint: bp.name,
      width: bp.width,
      fontSize: fontSize + "px",
      containerWidth: resolveContainerWidth(check, bp, horizontalPadding),
      horizontalPadding,
      text: resolveEffectiveText(check, bp),
      selector: resolveEffectiveSelector(check, bp),
    };
  });
}

export function buildResolvedConfig(config) {
  const breakpoints = config.breakpoints;
  const desktopBp = breakpoints[breakpoints.length - 1];

  return {
    ...config,
    checks: config.checks.map(check => ({
      label: check.label,
      text: check.text,
      page: check.page || "/",
      selector: check.selector || null,
      fontFamily: check.fontFamily,
      fontWeight: check.fontWeight || "400",
      lineHeight: check.lineHeight || 1.4,
      noWrap: !!check.noWrap,
      wrapStatus: check.wrapStatus || null,
      overflowStatus: check.overflowStatus || null,
      letterSpacingEm: check.letterSpacingEm || 0,
      textByBreakpoint: check.textByBreakpoint || null,
      textRules: check.textRules || null,
      selectorByBreakpoint: check.selectorByBreakpoint || null,
      selectorRules: check.selectorRules || null,
      hiddenBelowWidth: check.hiddenBelowWidth ?? null,
      hiddenAtOrBelowWidth: check.hiddenAtOrBelowWidth ?? null,
      hiddenAboveWidth: check.hiddenAboveWidth ?? null,
      hiddenAtOrAboveWidth: check.hiddenAtOrAboveWidth ?? null,
      resolved: resolveCheck(check, breakpoints),
      desktopResolved: resolveCheck(check, [desktopBp])[0],
    })),
  };
}
