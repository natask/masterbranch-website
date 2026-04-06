"use client";

import { useRef, useState, useLayoutEffect, useCallback } from "react";
import { FOOTER_TAGLINE, SITE_NAME } from "@/lib/config";

export function Footer() {
  const wordmarkRef = useRef<HTMLSpanElement>(null);
  const topRowRef = useRef<HTMLDivElement>(null);
  const [inset, setInset] = useState({ left: 0, right: 0 });
  const [stacked, setStacked] = useState(false);

  const fitWordmark = useCallback(() => {
    const wm = wordmarkRef.current;
    if (!wm) return null;

    const minFontSize = 12;
    const maxFontSize = 360;
    const gutter = 6;

    const fits = (fontSizePx: number) => {
      wm.style.fontSize = `${fontSizePx}px`;
      const rect = wm.getBoundingClientRect();
      return rect.left >= gutter && rect.right <= window.innerWidth - gutter;
    };

    let best = minFontSize;
    if (fits(maxFontSize)) {
      best = maxFontSize;
    } else if (fits(minFontSize)) {
      let low = minFontSize;
      let high = maxFontSize;

      for (let index = 0; index < 16; index += 1) {
        const mid = (low + high) / 2;
        if (fits(mid)) {
          best = mid;
          low = mid;
        } else {
          high = mid;
        }
      }
    }

    wm.style.fontSize = `${Math.round(best * 100) / 100}px`;
    return wm.getBoundingClientRect();
  }, []);

  const measure = useCallback(() => {
    const wm = wordmarkRef.current;
    const row = topRowRef.current;
    if (!wm || !row) return;

    const wmRect = fitWordmark() || wm.getBoundingClientRect();
    setInset({
      left: wmRect.left,
      right: window.innerWidth - wmRect.right,
    });

    // Check if the two spans overlap — if the row's scrollWidth exceeds its width
    setStacked(row.scrollWidth > row.clientWidth + 1);
  }, [fitWordmark]);

  useLayoutEffect(() => {
    let frameId = requestAnimationFrame(measure);
    const observer = new ResizeObserver(() => measure());
    if (wordmarkRef.current) observer.observe(wordmarkRef.current);
    if (topRowRef.current) observer.observe(topRowRef.current);
    window.addEventListener("resize", measure);
    document.fonts?.ready
      .then(() => {
        cancelAnimationFrame(frameId);
        frameId = requestAnimationFrame(measure);
      })
      .catch(() => {});
    return () => {
      cancelAnimationFrame(frameId);
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  return (
    <footer data-pretext="home-footer" className="relative overflow-hidden border-t border-border bg-background">
      <div
        ref={topRowRef}
        className={
          stacked
            ? "flex flex-col items-center gap-1 px-6 pb-2 pt-5 text-white/50"
            : "flex flex-row items-baseline justify-between pb-2 pt-5 text-white/50"
        }
        style={
          !stacked && inset.left > 0
            ? { paddingLeft: inset.left, paddingRight: inset.right }
            : undefined
        }
      >
        <span
          data-pretext="home-footer-copyright"
          className="font-cinzel"
          style={{
            fontSize: "clamp(10px, 1.1vw, 20px)",
            fontWeight: 400,
            letterSpacing: "0.05em",
            whiteSpace: "nowrap",
          }}
        >
          {SITE_NAME} &copy; {new Date().getFullYear()}
        </span>
        <span
          data-pretext="home-footer-tagline"
          style={{
            fontSize: "clamp(12px, 1.4vw, 22px)",
            fontWeight: 400,
            whiteSpace: "nowrap",
          }}
        >
          {FOOTER_TAGLINE}
        </span>
      </div>
      <div className="pointer-events-none select-none text-center leading-none" aria-hidden>
        <span
          data-pretext="home-footer-wordmark"
          ref={wordmarkRef}
          className="inline-block max-w-none font-cinzel font-bold text-foreground/[0.15]"
          style={{
            fontSize: "160px",
            lineHeight: 0.88,
            whiteSpace: "nowrap",
          }}
        >
          {SITE_NAME.toUpperCase()}
        </span>
      </div>
    </footer>
  );
}
