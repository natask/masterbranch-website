"use client";

import { forwardRef, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, HTMLAttributes } from "react";

type FitTextProps = HTMLAttributes<HTMLElement> & {
  as?: "span" | "p" | "div" | "h1" | "h2" | "h3";
  text?: string;
  minFontSize: number;
  maxFontSize?: number;
  targetLines?: number;
  noWrap?: boolean;
  preserveNewlines?: boolean;
};

function textLineCount(el: HTMLElement) {
  const range = document.createRange();
  range.selectNodeContents(el);
  const rects = Array.from(range.getClientRects()).filter((rect) => rect.width > 0.5 && rect.height > 0.5);
  if (!rects.length) return 0;

  const tops: number[] = [];
  for (const rect of rects) {
    const top = Math.round(rect.top * 2) / 2;
    if (!tops.some((value) => Math.abs(value - top) < 0.6)) {
      tops.push(top);
    }
  }

  return tops.length;
}

function textRects(el: HTMLElement) {
  const range = document.createRange();
  range.selectNodeContents(el);
  return Array.from(range.getClientRects()).filter((rect) => rect.width > 0.5 && rect.height > 0.5);
}

export const FitText = forwardRef<HTMLElement, FitTextProps>(function FitText(
  {
    as = "span",
    text,
    minFontSize,
    maxFontSize,
    targetLines,
    noWrap = false,
    preserveNewlines = false,
    style,
    children,
    ...rest
  },
  forwardedRef
) {
  const innerRef = useRef<HTMLElement | null>(null);
  const [fontSizePx, setFontSizePx] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el || fontSizePx === null) return;
    el.style.setProperty("font-size", `${fontSizePx}px`, "important");
  }, [fontSizePx]);

  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el) return;

    let frameId = 0;

    const fitsAtSize = (candidatePx: number) => {
      el.style.setProperty("font-size", `${candidatePx}px`, "important");
      void el.getBoundingClientRect();

      const rect = el.getBoundingClientRect();
      const clippedViewportX = rect.left < -0.5 || rect.right > window.innerWidth + 0.5;
      if (clippedViewportX) return false;

      const parentRect = el.parentElement?.getBoundingClientRect();
      for (const lineRect of textRects(el)) {
        if (lineRect.left < -0.5 || lineRect.right > window.innerWidth + 0.5) {
          return false;
        }
        if (parentRect && (lineRect.left < parentRect.left - 0.5 || lineRect.right > parentRect.right + 0.5)) {
          return false;
        }
      }

      if (noWrap) {
        return el.scrollWidth <= el.clientWidth + 1;
      }

      if (typeof targetLines === "number") {
        return textLineCount(el) <= targetLines;
      }

      return true;
    };

    const fit = () => {
      const previousInlineFontSize = el.style.getPropertyValue("font-size");
      const previousInlinePriority = el.style.getPropertyPriority("font-size");
      el.style.removeProperty("font-size");

      const computedFontSize = maxFontSize ?? parseFloat(window.getComputedStyle(el).fontSize);
      const lowerBound = Math.min(minFontSize, computedFontSize);
      let best = computedFontSize;

      if (!fitsAtSize(computedFontSize) && fitsAtSize(lowerBound)) {
        let low = lowerBound;
        let high = computedFontSize;

        for (let index = 0; index < 14; index += 1) {
          const mid = (low + high) / 2;
          if (fitsAtSize(mid)) {
            best = mid;
            low = mid;
          } else {
            high = mid;
          }
        }
      } else if (!fitsAtSize(computedFontSize)) {
        best = lowerBound;
      }

      if (previousInlineFontSize) {
        el.style.setProperty("font-size", previousInlineFontSize, previousInlinePriority);
      } else {
        el.style.removeProperty("font-size");
      }

      const rounded = Math.round(best * 100) / 100;
      setFontSizePx((current) => (current !== null && Math.abs(current - rounded) < 0.25 ? current : rounded));
    };

    const scheduleFit = () => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(fit);
    };

    const observer = new ResizeObserver(() => scheduleFit());
    if (el.parentElement) {
      observer.observe(el.parentElement);
    } else {
      observer.observe(el);
    }

    window.addEventListener("resize", scheduleFit);
    document.fonts?.ready.then(scheduleFit).catch(() => {});
    scheduleFit();

    return () => {
      cancelAnimationFrame(frameId);
      observer.disconnect();
      window.removeEventListener("resize", scheduleFit);
    };
  }, [children, maxFontSize, minFontSize, noWrap, targetLines, text]);

  const setRefs = (node: HTMLElement | null) => {
    innerRef.current = node;
    if (typeof forwardedRef === "function") {
      forwardedRef(node);
      return;
    }
    if (forwardedRef) {
      forwardedRef.current = node;
    }
  };

  const Tag = as;
  const mergedStyle: CSSProperties = {
    ...style,
    fontSize: fontSizePx ? `${fontSizePx}px` : style?.fontSize,
  };

  if (preserveNewlines) {
    mergedStyle.whiteSpace = "pre-line";
  }

  return (
    <Tag ref={setRefs} style={mergedStyle} {...rest}>
      {children ?? text}
    </Tag>
  );
});
