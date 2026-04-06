"use client";

import { useRef, useEffect, useState } from "react";
import { COMMUNITY_URL } from "@/lib/config";
import { Nav } from "@/components/nav";

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
  sectionHeading: "text-3xl md:text-4xl font-semibold leading-tight tracking-wide",
  body: "text-sm md:text-base font-medium tracking-wide",
  subtitle: "text-lg leading-[1.8]",
  small: "text-xs",
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

function CallResponse({ prompt, answer }: { prompt: string; answer: string }) {
  return (
    <div className="space-y-1.5">
      <p className={`${tf} ${ty.body} text-white/45`}>{prompt}</p>
      <p className={`${tf} ${ty.body} text-white`}>{answer}</p>
    </div>
  );
}

/* ── landing page ─────────────────────────────────────── */

export function LandingPage() {
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
              San Francisco
            </p>
          </FadeIn>

          <FadeIn delay={0.1}>
            <h1 data-pretext="home-hero-title" className="mt-8 font-cinzel text-4xl font-bold leading-[1.05] tracking-wide sm:text-6xl md:text-7xl lg:text-8xl">
              <span data-pretext="home-hero-title-master" className="text-gold-shimmer">The Master</span>
              <br />
              <span data-pretext="home-hero-title-branch" className="text-white">Branch</span>
            </h1>
          </FadeIn>

          <FadeIn delay={0.25}>
            <p data-pretext="home-hero-tagline" className={`${tf} mx-auto mt-10 max-w-2xl text-lg leading-relaxed text-white/50 md:text-xl`}>
              Build what you need.
            </p>
          </FadeIn>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━ MANIFESTO ━━━━━━━━━━━━━━━━ */}
      <section id="manifesto" data-pretext="home-manifesto" className="relative">
        <div className={`mx-auto max-w-3xl text-center ${sp.section}`}>
          <FadeIn><Divider /></FadeIn>

          <FadeIn delay={0.1}>
            <h2 data-pretext="home-manifesto-heading" className={`${sp.heading} font-cinzel ${ty.sectionHeading} text-white`}>
              Engineers&apos; Gym
            </h2>
          </FadeIn>

          <FadeIn delay={0.15}>
            <p data-pretext="home-manifesto-paragraph-0" className={`${sp.paragraphFirst} ${ty.subtitle} text-white/50 ${tf}`}>
              For those who solve their problems.
            </p>
          </FadeIn>

          <FadeIn delay={0.2}>
            <p data-pretext="home-manifesto-paragraph-1" className={`${sp.paragraph} ${ty.subtitle} text-white/50 ${tf}`}>
              For those who make their ideas real.
            </p>
          </FadeIn>

          <FadeIn delay={0.25}>
            <p data-pretext="home-manifesto-paragraph-2" className={`${sp.paragraph} ${ty.subtitle} text-white/50 ${tf}`}>
              For those who trade candid feedback.
            </p>
          </FadeIn>

          <FadeIn delay={0.3}>
            <p data-pretext="home-manifesto-paragraph-3" className={`${sp.paragraph} ${ty.subtitle} text-white/50 ${tf}`}>
              For those who learn by doing.
            </p>
          </FadeIn>

          <FadeIn delay={0.35}>
            <p data-pretext="home-manifesto-paragraph-4" className={`${sp.paragraph} ${ty.subtitle} text-gold/75 ${tf}`}>
              For those who crave the company of peers.
            </p>
          </FadeIn>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━ BUILDER PATH ━━━━━━━━━━━━━━━━ */}
      <section id="builder-path" data-pretext="home-builder-path" className="relative">
        <div className={`mx-auto max-w-3xl text-center ${sp.section}`}>
          <FadeIn><Divider /></FadeIn>

          <FadeIn delay={0.1}>
            <h2 data-pretext="home-builder-path-heading" className={`${sp.heading} font-cinzel ${ty.sectionHeading} text-white`}>
              Scratch your own itch
            </h2>
          </FadeIn>

          <FadeIn delay={0.15}>
            <div data-pretext="home-builder-path-paragraph-0" className={`${sp.paragraphFirst} flex flex-col items-center gap-6 text-center`}>
              <div className="space-y-4 md:space-y-5">
                <CallResponse prompt="Software annoying you?" answer="Clone it." />
              </div>
            </div>
          </FadeIn>

          <FadeIn delay={0.2}>
            <div data-pretext="home-builder-path-paragraph-1" className={`${sp.paragraphFirst} flex flex-col items-center gap-6 text-center`}>
              <div className="space-y-4 md:space-y-5">
                <CallResponse prompt="Workflow broken?" answer="Fix it." />
              </div>
            </div>
          </FadeIn>

          <FadeIn delay={0.25}>
            <div data-pretext="home-builder-path-paragraph-2" className={`${sp.paragraphFirst} flex flex-col items-center gap-6 text-center`}>
              <div className="space-y-4 md:space-y-5">
                <CallResponse prompt="Tool missing?" answer="Build it." />
              </div>
            </div>
          </FadeIn>

          <FadeIn delay={0.3}>
            <p data-pretext="home-builder-path-paragraph-3" className={`${sp.paragraph} ${tf} ${ty.body} text-white/35`}>
              If others need it too, even better.
            </p>
          </FadeIn>

          <FadeIn delay={0.35}>
            <p data-pretext="home-builder-path-accent" className={`${sp.accent} ${tf} text-xl font-medium tracking-wide text-gold/70`}>
              No one is going to solve your problems your way.
            </p>
          </FadeIn>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━ THE NIGHTS ━━━━━━━━━━━━━━━━ */}
      <section id="nights" data-pretext="home-nights">
        <div className={`${sp.sectionAlt} text-center`}>
          <FadeIn><Divider /></FadeIn>

          <FadeIn delay={0.1}>
            <h2 data-pretext="home-nights-heading" className={`${sp.heading} font-cinzel ${ty.sectionHeading} text-white whitespace-pre-line`}>
              {"Every day.\n6 - 10pm"}
            </h2>
          </FadeIn>

          <FadeIn delay={0.2}>
            <div className={`${sp.listWrap} ${sp.list}`}>

              <FadeIn delay={0.1}>
                <div className="flex flex-col items-center gap-2">
                  <h3 className="font-cinzel text-base font-semibold tracking-wide text-white/80">
                    <span className="mr-3 font-mono text-xs font-medium text-gold/30">01</span>
                    Arrive
                    <span className="ml-3 font-mono text-xs font-normal text-white/20">6:00</span>
                  </h3>
                  <p className={`${tf} mt-2 ${ty.body} text-white/40`}>Ready to build.</p>
                </div>
              </FadeIn>

              <FadeIn delay={0.18}>
                <div className="flex flex-col items-center gap-2">
                  <h3 className="font-cinzel text-base font-semibold tracking-wide text-white/80">
                    <span className="mr-3 font-mono text-xs font-medium text-gold/30">02</span>
                    Build
                    <span className="ml-3 font-mono text-xs font-normal text-white/20">10:00</span>
                  </h3>
                  <p className={`${tf} mt-2 ${ty.body} text-white/40`}>Heads down.</p>
                </div>
              </FadeIn>

              <FadeIn delay={0.26}>
                <div className="flex flex-col items-center gap-2">
                  <h3 className="font-cinzel text-base font-semibold tracking-wide text-white/80">
                    <span className="mr-3 font-mono text-xs font-medium text-gold/30">03</span>
                    Demo
                    <span className="ml-3 font-mono text-xs font-normal text-white/20">10:00+</span>
                  </h3>
                  <p className={`${tf} mt-2 ${ty.body} text-white/40`}>What you have.</p>
                </div>
              </FadeIn>

            </div>
          </FadeIn>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━ PRINCIPLES ━━━━━━━━━━━━━━━━ */}
      <section id="principles" data-pretext="home-principles">
        <div className={`mx-auto max-w-3xl ${sp.section}`}>
          <FadeIn><Divider /></FadeIn>

          <FadeIn delay={0.1}>
            <div className={`${sp.listWrap} ${sp.list} text-center`}>

              <FadeIn delay={0.15}>
                <div>
                  <p data-pretext="home-principle-0-title" className={`font-cinzel ${ty.subtitle} text-white/80`}>
                    No BS<span className="text-gold/40">.</span>
                  </p>
                  <p data-pretext="home-principle-0-description" className={`${tf} mt-1 ${ty.body} text-white/35`}>
                    Only what was built and how.
                  </p>
                </div>
              </FadeIn>

              <FadeIn delay={0.25}>
                <div>
                  <p data-pretext="home-principle-1-title" className={`font-cinzel ${ty.subtitle} text-white/80`}>
                    No Sponsors<span className="text-gold/40">.</span>
                  </p>
                  <p data-pretext="home-principle-1-description" className={`${tf} mt-1 ${ty.body} text-white/35`}>
                    Only us paying for our own tools.
                  </p>
                </div>
              </FadeIn>

              <FadeIn delay={0.35}>
                <div>
                  <p data-pretext="home-principle-2-title" className={`font-cinzel ${ty.subtitle} text-white/80`}>
                    No Excuses<span className="text-gold/40">.</span>
                  </p>
                  <p data-pretext="home-principle-2-description" className={`${tf} mt-1 ${ty.body} text-white/35`}>
                    Only unbounded ambition.
                  </p>
                </div>
              </FadeIn>

            </div>
          </FadeIn>

          <FadeIn delay={0.4}>
            <div className="mt-10 flex flex-col items-center gap-5 pt-4 text-center">
              <p data-pretext="home-challenge-prompt" className={`${tf} ${ty.subtitle} text-white/70`}>
                Think you belong?
              </p>
              <a
                data-pretext="home-join-link"
                href={COMMUNITY_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="shimmer-pill inline-flex items-center gap-2.5 rounded-full px-8 py-2.5 text-sm font-semibold shadow-layered-gold"
              >
                Prove it.
              </a>
              <p data-pretext="home-closing-footer" className={`${tf} ${ty.small} uppercase tracking-[0.4em] text-white/15`}>
                Master yourself. Master AI.
              </p>
            </div>
          </FadeIn>
        </div>
      </section>
    </div>
  );
}
