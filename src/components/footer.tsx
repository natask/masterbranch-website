"use client";

import { useRef, useState, useEffect } from "react";

export function Footer() {
  const wordmarkRef = useRef<HTMLSpanElement>(null);
  const [inset, setInset] = useState({ left: 0, right: 0 });

  useEffect(() => {
    const measure = () => {
      if (!wordmarkRef.current) return;
      const rect = wordmarkRef.current.getBoundingClientRect();
      setInset({ left: rect.left, right: window.innerWidth - rect.right });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  return (
    <footer className="relative overflow-hidden border-t border-border bg-background">
      <div
        className="flex items-baseline justify-between pb-2 pt-5 text-white/50"
        style={{ paddingLeft: inset.left, paddingRight: inset.right }}
      >
        <span
          className="font-cinzel"
          style={{
            fontSize: "clamp(10px, 1.1vw, 20px)",
            fontWeight: 400,
            letterSpacing: "0.05em",
          }}
        >
          The Master Branch &copy; {new Date().getFullYear()}
        </span>
        <span style={{ fontSize: "clamp(14px, 1.4vw, 22px)", fontWeight: 400 }}>
          Built by builders, for builders.
        </span>
      </div>
      <div className="pointer-events-none select-none text-center leading-none" aria-hidden>
        <span
          ref={wordmarkRef}
          className="inline-block whitespace-nowrap font-cinzel font-bold text-foreground/[0.09]"
          style={{ fontSize: "clamp(40px, 9vw, 160px)", lineHeight: 0.88 }}
        >
          THE MASTER BRANCH
        </span>
      </div>
    </footer>
  );
}
