"use client";

import { useRef, useEffect, useState } from "react";
import { landingCopy } from "@/content/landing-copy";
import type { ResponsiveCopy } from "@/content/copy-types";

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); io.disconnect(); } },
      { threshold }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return { ref, visible };
}

function FadeIn({ children, className = "", delay = 0 }: {
  children: React.ReactNode; className?: string; delay?: number;
}) {
  const { ref, visible } = useInView(0.12);
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(24px)",
        transition: `opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s, transform 0.8s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s`,
      }}
    >
      {children}
    </div>
  );
}

function Divider() {
  return (
    <div className="flex items-center justify-center gap-4 py-2">
      <div className="h-px flex-1 bg-gradient-to-r from-transparent to-white/[0.06]" />
      <div className="h-1 w-1 rounded-full bg-gold/40" />
      <div className="h-px flex-1 bg-gradient-to-l from-transparent to-white/[0.06]" />
    </div>
  );
}

function XIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function CopyText({ copy }: { copy: ResponsiveCopy }) {
  if (!copy.mobile || copy.mobile === copy.desktop) {
    return <>{copy.desktop}</>;
  }

  return (
    <>
      <span className="sm:hidden">{copy.mobile}</span>
      <span className="hidden sm:inline">{copy.desktop}</span>
    </>
  );
}

export function LandingPage() {
  return (
    <div className="min-h-screen">
      <nav className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <img src="/icon.png" alt="The Master Branch" className="h-7 w-7" />
            <span className="hidden font-cinzel text-sm font-semibold tracking-wider text-white sm:inline">
              The Master Branch
            </span>
          </div>
          <div className="flex items-center gap-6">
            <a href="/about" className="text-sm text-white/60 transition-colors hover:text-white">
              {landingCopy.nav.aboutLabel}
            </a>
            <a
              href="https://x.com/i/communities/2002012935854715211"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-white/60 transition-colors hover:text-gold"
            >
              <XIcon className="h-4 w-4" />
            </a>
          </div>
        </div>
      </nav>

      {/* ━━━━━━━━━━━━━━━━ HERO ━━━━━━━━━━━━━━━━ */}
      <section className="relative flex min-h-[calc(100vh-57px)] items-center justify-center overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-0 h-[600px] w-[800px] -translate-x-1/2 -translate-y-1/4 rounded-full bg-gold/[0.04] blur-[140px]" />
          <div className="absolute bottom-0 left-1/2 h-[300px] w-[600px] -translate-x-1/2 translate-y-1/3 rounded-full bg-gold/[0.02] blur-[100px]" />
        </div>

        <div className="relative mx-auto max-w-4xl px-6 text-center">
          <FadeIn>
            <p className="font-cinzel text-xs font-medium uppercase tracking-[0.35em] text-gold/60">
              {landingCopy.hero.location}
            </p>
          </FadeIn>

          <FadeIn delay={0.1}>
            <h1 className="mt-8 font-cinzel text-6xl font-bold leading-[1.05] tracking-wide md:text-7xl lg:text-8xl">
              <span className="text-gold-shimmer">The Master</span>
              <br />
              <span className="text-white">Branch</span>
            </h1>
          </FadeIn>

          <FadeIn delay={0.25}>
            <p className="mx-auto mt-10 max-w-2xl text-lg leading-relaxed text-white/50 md:text-xl">
              <CopyText copy={landingCopy.hero.tagline} />
            </p>
          </FadeIn>

          <FadeIn delay={0.4}>
            <div className="mt-12">
              <a
                href="https://x.com/i/communities/2002012935854715211"
                target="_blank"
                rel="noopener noreferrer"
                className="shimmer-pill inline-flex items-center gap-2.5 rounded-full px-8 py-2.5 text-sm font-semibold shadow-layered-gold"
              >
                {landingCopy.nav.joinLabel}
              </a>
            </div>
          </FadeIn>

          <FadeIn delay={0.6}>
            <div className="mt-20 flex justify-center">
              <div className="flex h-8 w-5 items-start justify-center rounded-full border border-white/10 p-1">
                <div
                  className="h-1.5 w-1 rounded-full bg-gold/50"
                  style={{ animation: "scrollDot 2s ease-in-out infinite" }}
                />
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━ MANIFESTO ━━━━━━━━━━━━━━━━ */}
      <section className="relative mx-auto max-w-3xl px-6 py-32 md:py-40">
        <FadeIn><Divider /></FadeIn>

        <FadeIn delay={0.1}>
          <h2 className="mt-16 font-cinzel text-3xl font-semibold leading-tight tracking-wide text-white md:text-4xl">
            <CopyText copy={landingCopy.manifesto.heading} />
          </h2>
        </FadeIn>

        {landingCopy.manifesto.paragraphs.map((paragraph, index) => (
          <FadeIn key={`${paragraph.desktop}-${index}`} delay={0.15 + index * 0.05}>
            <p className={`${index === 0 ? "mt-8" : "mt-6"} text-lg leading-[1.8] text-white/50`}>
              <CopyText copy={paragraph} />
            </p>
          </FadeIn>
        ))}

        <FadeIn delay={0.35}>
          <p className="mt-10 font-cinzel text-xl font-medium tracking-wide text-gold/70">
            <CopyText copy={landingCopy.manifesto.accent} />
          </p>
        </FadeIn>
      </section>

      {/* ━━━━━━━━━━━━━━━━ THE NIGHTS ━━━━━━━━━━━━━━━━ */}
      <section className="section-alt">
        <div className="mx-auto max-w-3xl px-6 py-32 md:py-40">
          <FadeIn><Divider /></FadeIn>

          <FadeIn delay={0.1}>
            <h2 className="mt-16 font-cinzel text-3xl font-semibold leading-tight tracking-wide text-white md:text-4xl">
              <CopyText copy={landingCopy.nights.heading} />
            </h2>
          </FadeIn>

          <FadeIn delay={0.2}>
            <div className="mt-14 space-y-10">
              {landingCopy.nights.steps.map((step, i) => (
                <FadeIn key={step.num} delay={0.1 + i * 0.08}>
                  <div className="flex gap-6">
                    <span className="font-mono text-xs font-medium text-gold/30 pt-1.5">{step.num}</span>
                    <div>
                      <h3 className="font-cinzel text-base font-semibold tracking-wide text-white/80">
                        {step.title}
                        <span className="ml-3 font-mono text-xs font-normal text-white/20">{step.time}</span>
                      </h3>
                      <p className="mt-2 text-sm leading-relaxed text-white/40">
                        <CopyText copy={step.text} />
                      </p>
                    </div>
                  </div>
                </FadeIn>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━ PRINCIPLES ━━━━━━━━━━━━━━━━ */}
      <section className="mx-auto max-w-3xl px-6 py-32 md:py-40">
        <FadeIn><Divider /></FadeIn>

        <FadeIn delay={0.1}>
          <div className="mt-16 space-y-10">
            {landingCopy.principles.map((item, i) => (
              <FadeIn key={item.title} delay={0.15 + i * 0.1}>
                <div>
                  <p className="font-cinzel text-lg font-semibold tracking-wide text-white/80">
                    {item.title}<span className="text-gold/40">.</span>
                  </p>
                  <p className="mt-1 text-sm text-white/35">{item.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </FadeIn>
      </section>

      {/* ━━━━━━━━━━━━━━━━ CLOSING ━━━━━━━━━━━━━━━━ */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-1/2 h-[500px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold/[0.03] blur-[120px]" />
        </div>

        <div className="relative mx-auto max-w-3xl px-6 py-32 text-center md:py-44">
          <FadeIn><Divider /></FadeIn>

          <FadeIn delay={0.1}>
            <p className="mt-16 font-cinzel text-2xl font-semibold leading-snug tracking-wide text-white md:text-3xl">
              {landingCopy.closing.heading}
            </p>
          </FadeIn>

          <FadeIn delay={0.3}>
            <div className="mt-12">
              <a
                href="https://x.com/i/communities/2002012935854715211"
                target="_blank"
                rel="noopener noreferrer"
                className="shimmer-pill inline-flex items-center gap-2.5 rounded-full px-8 py-2.5 text-sm font-semibold shadow-layered-gold"
              >
                {landingCopy.closing.joinLabel}
              </a>
            </div>
          </FadeIn>

          <FadeIn delay={0.4}>
            <p className="mt-20 font-cinzel text-xs uppercase tracking-[0.4em] text-white/15">
              {landingCopy.closing.footer}
            </p>
          </FadeIn>
        </div>
      </section>

      <style>{`
        @keyframes scrollDot {
          0%, 100% { opacity: 0.4; transform: translateY(0); }
          50% { opacity: 1; transform: translateY(6px); }
        }
      `}</style>
    </div>
  );
}
