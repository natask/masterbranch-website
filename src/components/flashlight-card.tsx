"use client";

import { useCallback, useRef, useEffect } from "react";

const GLIDE_MS = 300;

/** Wraps the full page and paints a subtle flashlight on the background.
 *  Snaps instantly while the cursor is on the page.
 *  On re-entry after leaving, glides from the last frozen position to the cursor. */
export function FlashlightBackground({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const cursor = useRef({ x: 0, y: 0 });
  const pos = useRef({ x: -900, y: -900 });
  const glideFrom = useRef({ x: 0, y: 0 });
  const glideT0 = useRef(0);
  const rafId = useRef<number>(0);

  const set = useCallback((x: number, y: number) => {
    const el = ref.current;
    if (!el) return;
    pos.current.x = x;
    pos.current.y = y;
    el.style.setProperty("--fl-x", `${x}px`);
    el.style.setProperty("--fl-y", `${y}px`);
  }, []);

  const endGlide = useCallback(() => {
    glideT0.current = 0;
    cancelAnimationFrame(rafId.current);
    set(cursor.current.x, cursor.current.y);
  }, [set]);

  const glideTick = useCallback(
    (now: number) => {
      const t = Math.min((now - glideT0.current) / GLIDE_MS, 1);
      const e = 1 - (1 - t) * (1 - t) * (1 - t); // ease-out cubic
      const x = glideFrom.current.x + (cursor.current.x - glideFrom.current.x) * e;
      const y = glideFrom.current.y + (cursor.current.y - glideFrom.current.y) * e;

      // Close enough to cursor — snap and resume direct tracking
      if (Math.abs(x - cursor.current.x) < 15 && Math.abs(y - cursor.current.y) < 15) {
        endGlide();
        return;
      }
      set(x, y);
      if (t < 1) {
        rafId.current = requestAnimationFrame(glideTick);
      } else {
        endGlide();
      }
    },
    [set, endGlide],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      cursor.current.x = e.clientX;
      cursor.current.y = e.clientY;
      if (glideT0.current > 0) return; // glide in progress — rAF handles it
      set(e.clientX, e.clientY);
    },
    [set],
  );

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      cursor.current.x = e.clientX;
      cursor.current.y = e.clientY;
      const dx = Math.abs(pos.current.x - e.clientX);
      const dy = Math.abs(pos.current.y - e.clientY);
      if (pos.current.x <= -900 || (dx < 5 && dy < 5)) {
        set(e.clientX, e.clientY);
        return;
      }
      // Re-entry — glide from frozen position to cursor
      glideFrom.current = { x: pos.current.x, y: pos.current.y };
      glideT0.current = performance.now();
      cancelAnimationFrame(rafId.current);
      rafId.current = requestAnimationFrame(glideTick);
    },
    [set, glideTick],
  );

  const handleMouseLeave = useCallback(() => {
    cancelAnimationFrame(rafId.current);
    glideT0.current = 0;
  }, []);

  useEffect(() => () => cancelAnimationFrame(rafId.current), []);

  return (
    <div
      ref={ref}
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`flashlight-bg ${className}`}
    >
      {children}
    </div>
  );
}

/** @deprecated — kept for bento grid cells; no longer has flashlight pseudo-elements. */
export function FlashlightCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={className}>{children}</div>;
}
