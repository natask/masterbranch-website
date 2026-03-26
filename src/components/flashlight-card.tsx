"use client";

import { useCallback, useRef } from "react";

/** Wraps the full page and paints a subtle flashlight on the background. */
export function FlashlightBackground({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--fl-x", `${e.clientX}px`);
    el.style.setProperty("--fl-y", `${e.clientY}px`);
  }, []);

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
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
