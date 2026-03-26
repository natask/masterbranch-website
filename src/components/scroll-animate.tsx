"use client";

import { useEffect, useRef } from "react";

type AnimationType = "scroll-fade-up" | "scroll-blur-in" | "scroll-slide-in" | "scroll-stagger";

export function ScrollAnimate({
  children,
  animation = "scroll-fade-up",
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  animation?: AnimationType;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (delay > 0) {
            setTimeout(() => el.classList.add("in-view"), delay);
          } else {
            el.classList.add("in-view");
          }
          observer.unobserve(el);
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [delay]);

  return (
    <div ref={ref} className={`${animation} ${className}`}>
      {children}
    </div>
  );
}
