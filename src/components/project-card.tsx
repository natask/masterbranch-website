"use client";

import { useCallback, useRef } from "react";
import { PERSPECTIVE, normaliseMouse, buildTiltTransform, getTiltTransition } from "@/lib/project-card-tilt";

export function ProjectCard({
  children,
  className = "",
  ...props
}: {
  children: React.ReactNode;
  className?: string;
} & React.HTMLAttributes<HTMLDivElement>) {
  const ref = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);
  const enteringRef = useRef(false);

  const handleMouseEnter = useCallback(() => {
    enteringRef.current = true;
    const el = ref.current;
    if (el) el.style.setProperty("--spotlight-opacity", "0");
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const target = e.target as HTMLElement;
    if (target.closest("a, button, input, textarea, [role='button']")) return;
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => {
      const rect = el.getBoundingClientRect();
      const { x, y, nx, ny } = normaliseMouse(e.clientX, e.clientY, rect);
      el.style.setProperty("--mouse-x", `${x}px`);
      el.style.setProperty("--mouse-y", `${y}px`);
      el.style.setProperty("--nx", `${nx.toFixed(3)}`);
      el.style.setProperty("--ny", `${ny.toFixed(3)}`);
      const isEntering = enteringRef.current;
      if (isEntering) {
        el.style.setProperty("--spotlight-opacity", "1");
        enteringRef.current = false;
      }
      el.style.transition = getTiltTransition(isEntering);
      el.style.transform = buildTiltTransform(nx, ny);
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    el.style.setProperty("--spotlight-opacity", "0");
    el.style.transition = "transform 0.55s cubic-bezier(0.03, 0.98, 0.52, 0.99), box-shadow 0.55s ease";
    el.style.transform = `perspective(${PERSPECTIVE}px) rotateX(0deg) rotateY(0deg) translateZ(0px)`;
    el.style.setProperty("--mouse-x", "-400px");
    el.style.setProperty("--mouse-y", "-400px");
  }, []);

  return (
    <div
      ref={ref}
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`project-card ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
