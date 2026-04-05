"use client";

import { useRef, useEffect, useState } from "react";
import { landingCopy } from "@/content/landing-copy";
import type { ResponsiveCopy } from "@/content/copy-types";
import { COMMUNITY_URL } from "@/lib/config";
import { Nav } from "@/components/nav";

const landingSpacing = {
  divider: "flex items-center justify-center gap-4 py-0",
  section: "px-6 py-8 md:py-10",
  sectionAlt: "mx-auto max-w-3xl px-6 py-12 md:py-16",
  heading: "mt-10",
  paragraphFirst: "mt-8",
  paragraph: "mt-6",
  accent: "mt-8",
  listWrap: "mt-10",
  list: "space-y-8",
  closingCta: "mt-10",
  closingFooter: "mt-14",
};

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
    <div className={landingSpacing.divider}>
      <div className="h-px flex-1 bg-gradient-to-r from-transparent to-white/[0.06]" />
      <div className="h-1 w-1 rounded-full bg-gold/40" />
      <div className="h-px flex-1 bg-gradient-to-l from-transparent to-white/[0.06]" />
    </div>
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
  const emphasizedManifestoLines = new Set([
    "Software annoying you? Clone it.",
    "Workflow broken? Fix it.",
    "Tool missing? Build it.",
    "If others need it too, even better.",
  ]);
  const goldManifestoLines = new Set([
    "For those who crave the company of peers.",
  ]);

  return (
    <div className="min-h-screen">
      <Nav variant="landing" />
      {/* ━━━━━━━━━━━━━━━━ HERO ━━━━━━━━━━━━━━━━ */}
      <section id="hero" data-pretext="home-hero" className="relative flex min-h-[80vh] items-center justify-center overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-0 h-[600px] w-[800px] -translate-x-1/2 -translate-y-1/4 rounded-full bg-gold/[0.04] blur-[140px]" />
          <div className="absolute bottom-0 left-1/2 h-[300px] w-[600px] -translate-x-1/2 translate-y-1/3 rounded-full bg-gold/[0.02] blur-[100px]" />
        </div>

        <div className="relative mx-auto max-w-4xl px-6 py-10 text-center md:py-14">
          <FadeIn>
            <p data-pretext="home-location" className="font-cinzel text-xs font-medium uppercase tracking-[0.35em] text-gold/60">
              {landingCopy.hero.location}
            </p>
          </FadeIn>

          <FadeIn delay={0.1}>
            <h1 data-pretext="home-hero-title" className="mt-8 font-cinzel text-4xl font-bold leading-[1.05] tracking-wide sm:text-6xl md:text-7xl lg:text-8xl">
              <span className="text-gold-shimmer">The Master</span>
              <br />
              <span className="text-white">Branch</span>
            </h1>
          </FadeIn>

          <FadeIn delay={0.25}>
            <p data-pretext="home-hero-tagline" className="mx-auto mt-10 max-w-2xl text-lg leading-relaxed text-white/50 md:text-xl">
              <CopyText copy={landingCopy.hero.tagline} />
            </p>
          </FadeIn>

        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━ MANIFESTO ━━━━━━━━━━━━━━━━ */}
      {landingCopy.manifesto.map((group, groupIndex) => (
        <section
          key={`manifesto-${groupIndex}`}
          id={groupIndex === 0 ? "manifesto" : "builder-path"}
          data-pretext={groupIndex === 0 ? "home-manifesto" : "home-builder-path"}
          className="relative"
        >
          <div className={`mx-auto max-w-3xl text-center ${landingSpacing.section}`}>
            <FadeIn><Divider /></FadeIn>

            {group.heading.desktop ? (
              <FadeIn delay={0.1}>
                <h2 className={`${landingSpacing.heading} font-cinzel text-3xl font-semibold leading-tight tracking-wide text-white md:text-4xl`}>
                  <CopyText copy={group.heading} />
                </h2>
              </FadeIn>
            ) : null}

            {group.paragraphs.map((paragraph, index) => (
              <FadeIn key={`${paragraph.desktop}-${index}`} delay={0.15 + index * 0.05}>
                <p
                  className={`${
                    index === 0 ? landingSpacing.paragraphFirst : landingSpacing.paragraph
                  } ${
                    paragraph.desktop.trim() === "Scratch your own itch"
                      ? "font-cinzel text-2xl font-semibold tracking-wide text-white md:text-3xl"
                      : goldManifestoLines.has(paragraph.desktop.trim())
                        ? "text-lg leading-[1.8] text-gold/75"
                      : emphasizedManifestoLines.has(paragraph.desktop.trim())
                        ? "text-lg leading-[1.8] text-white/80"
                      : "text-lg leading-[1.8] text-white/50"
                  }`}
                >
                  <CopyText copy={paragraph} />
                </p>
              </FadeIn>
            ))}

            {group.accent.desktop ? (
              <FadeIn delay={0.35}>
                <p className={`${landingSpacing.accent} font-cinzel text-xl font-medium tracking-wide text-gold/70`}>
                  <CopyText copy={group.accent} />
                </p>
              </FadeIn>
            ) : null}
          </div>
        </section>
      ))}

      {/* ━━━━━━━━━━━━━━━━ THE NIGHTS ━━━━━━━━━━━━━━━━ */}
      <section id="nights" data-pretext="home-nights">
        <div className={`${landingSpacing.sectionAlt} text-center`}>
          <FadeIn><Divider /></FadeIn>

          <FadeIn delay={0.1}>
            <h2 className={`${landingSpacing.heading} font-cinzel text-3xl font-semibold leading-tight tracking-wide text-white md:text-4xl`}>
              <CopyText copy={landingCopy.nights.heading} />
            </h2>
          </FadeIn>

          <FadeIn delay={0.2}>
            <div className={`${landingSpacing.listWrap} ${landingSpacing.list}`}>
              {landingCopy.nights.steps.map((step, i) => (
                <FadeIn key={step.num} delay={0.1 + i * 0.08}>
                  <div className="flex flex-col items-center gap-2">
                    <h3 className="font-cinzel text-base font-semibold tracking-wide text-white/80">
                      <span className="mr-3 font-mono text-xs font-medium text-gold/30">{step.num}</span>
                      {step.title}
                      <span className="ml-3 font-mono text-xs font-normal text-white/20">{step.time}</span>
                    </h3>
                    <div className="text-center">
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
      <section id="principles" data-pretext="home-principles">
        <div className={`mx-auto max-w-3xl ${landingSpacing.section}`}>
          <FadeIn><Divider /></FadeIn>

          <FadeIn delay={0.1}>
            <div className={`${landingSpacing.listWrap} ${landingSpacing.list} text-center`}>
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

          <FadeIn delay={0.4}>
            <div className="mt-10 flex flex-col items-center gap-5 pt-4 text-center">
              <p className="font-cinzel text-lg font-medium tracking-wide text-white/70">
                {landingCopy.actions.challengePrompt}
              </p>
              <a
                href={COMMUNITY_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="shimmer-pill inline-flex items-center gap-2.5 rounded-full px-8 py-2.5 text-sm font-semibold shadow-layered-gold"
              >
                {landingCopy.actions.joinLabel}
              </a>
              <p className="font-cinzel text-xs uppercase tracking-[0.4em] text-white/15">
                {landingCopy.closing.footer}
              </p>
            </div>
          </FadeIn>
        </div>
      </section>
    </div>
  );
}
