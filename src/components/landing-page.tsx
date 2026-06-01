"use client";

import { useRef, useEffect, useState } from "react";
import Image from "next/image";
import { COMMUNITY_URL } from "@/lib/config";
import { Nav } from "@/components/nav";
import { FitText } from "@/components/ui/fit-text";
import { landingCopy } from "@/content/landing-copy";
import type { ContentBlock } from "@/content/landing-copy";

/* ── spacing & typography tokens ──────────────────────── */

const sp = {
  divider: "flex items-center justify-center gap-4 py-0",
  section: "px-6 py-8 md:py-10",
  sectionAlt: "mx-auto max-w-3xl px-6 py-12 md:py-16",
  heading: "mt-10",
  paragraphFirst: "mt-8",
  paragraph: "mt-6",
  accent: "mt-8",
  listWrap: "mt-10",
  list: "space-y-8",
};

const ty = {
  sectionHeading: "fluid-h2 font-normal leading-tight tracking-wide",
  body: "fluid-body leading-relaxed",
  subtitle: "fluid-subtitle leading-[1.5]",
  small: "fluid-xs",
};

const tf = "font-body-text";

/* ── utilities ────────────────────────────────────────── */

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
    <div className={sp.divider}>
      <div className="h-px flex-1 bg-gradient-to-r from-transparent to-white/[0.06]" />
      <div className="h-1 w-1 rounded-full bg-gold/40" />
      <div className="h-px flex-1 bg-gradient-to-l from-transparent to-white/[0.06]" />
    </div>
  );
}

/* ── markup parser ────────────────────────────────────── */

function parseMarkup(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  // Match combinations (priority order):
  // ***text*** or **_text_** (bold+italic)
  // **__text__** (bold+underline)
  // *__text__* (italic+underline)
  // __text__ (underline)
  // **text** (bold)
  // *text* (italic)
  const regex = /\*\*\*(.+?)\*\*\*|\*\*_(.+?)_\*\*|_\*\*(.+?)\*\*_|\*\*__(.+?)__\*\*|\*__(.+?)__\*|__\*\*(.+?)\*\*__|__\*(.+?)\*__|__(.+?)__|\*\*(.+?)\*\*|\*(.+?)\*/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const content = match[1] || match[2] || match[3] || match[4] || match[5] || match[6] || match[7] || match[8] || match[9] || match[10];
    const key = parts.length;

    if (match[1] || match[2] || match[3]) {
      // ***content*** or **_content_** or _**content**_
      parts.push(<span key={key} className="font-bold italic">{content}</span>);
    } else if (match[4]) {
      // **__content__**
      parts.push(<span key={key} className="font-bold underline">{content}</span>);
    } else if (match[5]) {
      // *__content__*
      parts.push(<span key={key} className="italic underline">{content}</span>);
    } else if (match[6]) {
      // __**content**__
      parts.push(<span key={key} className="font-bold underline">{content}</span>);
    } else if (match[7]) {
      // __*content*__
      parts.push(<span key={key} className="italic underline">{content}</span>);
    } else if (match[8]) {
      // __content__
      parts.push(<span key={key} className="underline">{content}</span>);
    } else if (match[9]) {
      // **content**
      parts.push(<span key={key} className="font-bold">{content}</span>);
    } else if (match[10]) {
      // *content*
      parts.push(<span key={key} className="italic">{content}</span>);
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}

/* ── block renderer ───────────────────────────────────── */

const statementTone = {
  default: `${ty.body} text-white/50`,
  gold: `fluid-accent text-gold/75`,
  muted: `${ty.body} text-white/35`,
} as const;

function Block({ block, index }: {
  block: ContentBlock; index: number;
}) {
  const spacing = index === 0 ? sp.paragraphFirst : sp.paragraph;
  const blockSpacing = `landing-copy-block ${index === 0 ? "landing-copy-block-first" : ""}`;

  switch (block.type) {
    case "statement":
      return (
        <p className={`${spacing} ${blockSpacing} landing-body-text ${statementTone[block.tone ?? "default"]} ${tf} whitespace-pre-wrap`}>
          {parseMarkup(block.text)}
        </p>
      );

    case "call-response":
      return (
        <div className={`${spacing} ${blockSpacing} landing-call-response flex flex-col items-center gap-6 text-center`}>
          <div className="space-y-4 md:space-y-5">
            <div className="landing-qa-pair space-y-1.5">
              <p className={`landing-body-text ${tf} ${ty.body} text-white/45`}>{parseMarkup(block.prompt)}</p>
              <p className={`landing-body-text ${tf} ${ty.body} text-white`}>{parseMarkup(block.answer)}</p>
            </div>
          </div>
        </div>
      );

    case "accent":
      return (
        <p className={`${sp.accent} ${blockSpacing} landing-accent-text ${tf} fluid-accent tracking-wide text-gold whitespace-pre-wrap`}>
          {parseMarkup(block.text)}
        </p>
      );
  }
}

/* ── landing page ─────────────────────────────────────── */

export function LandingPage() {
  return (
    <div className="min-h-screen">
      <Nav variant="landing" />

      {/* ━━━━━━━━━━━━━━━━ HERO ━━━━━━━━━━━━━━━━ */}
      <section id="hero" className="relative flex min-h-[80vh] items-center justify-center overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-0 h-[600px] w-[800px] -translate-x-1/2 -translate-y-1/4 rounded-full bg-gold/[0.04] blur-[140px]" />
          <div className="absolute bottom-0 left-1/2 h-[300px] w-[600px] -translate-x-1/2 translate-y-1/3 rounded-full bg-gold/[0.02] blur-[100px]" />
        </div>

        <div className="landing-hero-content relative mx-auto w-full max-w-4xl px-6 py-10 text-center md:py-14">
          <FadeIn>
            <Image
              src="/icon.png"
              alt="Masterbranch emblem"
              width={96}
              height={96}
              priority
              className="landing-hero-icon mx-auto mb-5 h-[44px] w-[44px] object-contain drop-shadow-[0_0_20px_rgba(201,165,92,0.18)] sm:h-[52px] sm:w-[52px] md:h-[60px] md:w-[60px]"
            />
          </FadeIn>

          <FadeIn delay={0.05}>
            <p className="landing-hero-topline font-cinzel fluid-xs font-medium uppercase tracking-[0.35em] text-gold/60">
              {landingCopy.hero.location}
            </p>
          </FadeIn>

          <FadeIn delay={0.1}>
            <FitText
              as="h1"
              className="landing-hero-title landing-hero-title-two mt-8 font-cinzel fluid-hero font-normal leading-[1.05] tracking-wide"
              text="The Master Branch"
              minFontSize={44}
              maxFontSize={210}
              targetLines={2}
            >
              <span className="whitespace-nowrap text-gold-shimmer">The Master</span>
              <br />
              <span className="whitespace-nowrap text-white">Branch</span>
            </FitText>
            {process.env.NODE_ENV === "development" && (
              <FitText
                as="h1"
                className="landing-hero-title landing-hero-title-three mt-8 font-cinzel fluid-hero font-normal leading-[1.05] tracking-wide"
                text="THE MASTER BRANCH"
                minFontSize={44}
                maxFontSize={210}
                targetLines={3}
              >
                <span className="whitespace-nowrap text-gold-shimmer">THE</span>
                <br />
                <span className="whitespace-nowrap text-gold-shimmer">MASTER</span>
                <br />
                <span className="whitespace-nowrap text-white">BRANCH</span>
              </FitText>
            )}
          </FadeIn>

          <FadeIn delay={0.25}>
            <p className={`landing-hero-tagline ${tf} mx-auto mt-10 max-w-2xl fluid-subtitle leading-relaxed text-white/50`}>
              {landingCopy.hero.tagline}
            </p>
          </FadeIn>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━ CONTENT SECTIONS ━━━━━━━━━━━━━━━━ */}
      {landingCopy.sections.map((section) => (
        <section key={section.id} id={section.id} className="relative">
          <div className={`landing-section mx-auto max-w-3xl text-center ${sp.section}`}>
            <FadeIn><Divider /></FadeIn>

            <FadeIn delay={0.1}>
              <h2 className={`${sp.heading} landing-section-heading font-cinzel ${ty.sectionHeading} text-white whitespace-pre-wrap`}>
                {section.heading}
              </h2>
            </FadeIn>

            <div className="landing-section-body">
              {section.blocks.map((block, i) => (
                <FadeIn key={`${section.id}-${i}`} delay={0.15 + i * 0.05}>
                  <Block block={block} index={i} />
                </FadeIn>
              ))}
            </div>
          </div>
        </section>
      ))}

      {/* ━━━━━━━━━━━━━━━━ THE NIGHTS ━━━━━━━━━━━━━━━━ */}
      <section id="nights">
        <div className={`${sp.sectionAlt} text-center`}>
          <FadeIn><Divider /></FadeIn>

          <FadeIn delay={0.1}>
            <h2 className={`${sp.heading} landing-section-heading font-cinzel ${ty.sectionHeading} text-white whitespace-pre-wrap`}>
              {landingCopy.nights.heading}
            </h2>
          </FadeIn>

          <FadeIn delay={0.2}>
            <div className={`landing-schedule-list landing-list ${sp.listWrap} ${sp.list}`}>
              {landingCopy.nights.steps.map((step, i) => (
                <FadeIn key={step.num} className="landing-schedule-item" delay={0.1 + i * 0.08}>
                  <div className="landing-schedule-row flex flex-col items-center gap-2">
                    <span className="landing-schedule-num font-mono fluid-xs font-medium text-gold/30">{step.num}</span>
                    <div className="landing-schedule-main">
                      <h3 className="landing-step-title font-cinzel fluid-body font-normal tracking-wide text-white/80">
                        {step.title}
                      </h3>
                      <p className={`landing-schedule-desc landing-body-text ${tf} mt-2 ${ty.body} text-white/40`}>{step.desc}</p>
                    </div>
                    <span className="landing-schedule-time font-mono fluid-xs font-normal text-white/20">{step.time}</span>
                  </div>
                </FadeIn>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━ PRINCIPLES ━━━━━━━━━━━━━━━━ */}
      <section id="principles">
        <div className={`mx-auto max-w-3xl ${sp.section}`}>
          <FadeIn><Divider /></FadeIn>

          <FadeIn delay={0.1}>
            <div className={`landing-list ${sp.listWrap} ${sp.list} text-center`}>
              {landingCopy.principles.map((item, i) => (
                <FadeIn key={item.title} delay={0.15 + i * 0.1}>
                  <div>
                    <p className={`landing-principle-title font-cinzel ${ty.subtitle} text-white/80`}>
                      {item.title}<span className="text-gold/40">.</span>
                    </p>
                    <p className={`landing-body-text ${tf} mt-1 ${ty.body} text-white/35`}>
                      {item.desc}
                    </p>
                  </div>
                </FadeIn>
              ))}
            </div>
          </FadeIn>

          <FadeIn delay={0.4}>
            <div className="mt-10 flex flex-col items-center gap-5 pt-4 text-center">
              <p className={`landing-body-text ${tf} ${ty.subtitle} text-white/70`}>
                {landingCopy.cta.prompt}
              </p>
              <a
                href={COMMUNITY_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="shimmer-pill inline-flex items-center gap-2.5 rounded-full px-8 py-2.5 fluid-body font-normal shadow-layered-gold"
              >
                {landingCopy.cta.label}
              </a>
              <p className={`${tf} ${ty.small} uppercase tracking-[0.4em] text-white/15 whitespace-pre-wrap`}>
                {landingCopy.cta.footer}
              </p>
            </div>
          </FadeIn>
        </div>
      </section>
    </div>
  );
}
