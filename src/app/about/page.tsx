"use client";

import { Nav } from "@/components/nav";
import { FlashlightBackground } from "@/components/flashlight-card";
import Link from "next/link";

export default function AboutPage() {
  return (
    <FlashlightBackground className="min-h-screen">
      <Nav />

      <main className="mx-auto max-w-2xl px-6 py-24">
        {/* Hero */}
        <header className="mb-20">
          <h1 className="font-cinzel text-5xl font-bold leading-[1.1] tracking-wide md:text-6xl">
            <span className="text-gold-shimmer">The Master</span>
            <br />
            <span className="text-white">Branch</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
            SF&rsquo;s hacker club for builders who want to stay on the absolute cutting edge.
          </p>
        </header>

        {/* Origin */}
        <section className="mb-14">
          <p className="text-foreground/80 leading-relaxed">
            Inspired by{" "}
            <Link
              href="https://sundai.club"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold underline-offset-4 hover:underline"
            >
              Sundai Club
            </Link>
            , we&rsquo;re building a community of true hackers — people who build, ship, and shortcut.
            This is about the pure joy of creation, powered by AI.
          </p>
        </section>

        {/* Hack vs Hackathon */}
        <section className="mb-14">
          <h2 className="font-serif text-2xl font-semibold mb-4">Hack vs. Hackathon</h2>
          <p className="text-foreground/80 leading-relaxed mb-4">
            This is a hacking group, not a hackathon. Hackathons are competitive events: tight timelines,
            pre-formed teams, sponsor prizes, and half-finished prototypes that die after demo day.
          </p>
          <p className="text-foreground/80 leading-relaxed mb-4">
            Here at Master Branch we play the long game.
          </p>
          <p className="text-foreground/80 leading-relaxed mb-4">
            We are hyper-competitive — against our past selves. We compete to see who can build the most
            useful project. We rank projects. We track outcomes. We celebrate the winners.
          </p>
          <p className="text-foreground/80 leading-relaxed">
            But we win together. Cooperation isn&rsquo;t the opposite of competition — it&rsquo;s how you win.
            The metric isn&rsquo;t applause. It&rsquo;s adoption.
          </p>
        </section>

        {/* How It Works */}
        <section className="mb-14">
          <h2 className="font-serif text-2xl font-semibold mb-4">How It Works</h2>
          <p className="text-foreground/80 leading-relaxed mb-6">
            We meet weekly on Sundais for all-day hacking sessions — 1 PM to 5 PM, four hours of rapid
            prototyping. You can build a surprising amount in four hours with AI.
          </p>

          <ol className="space-y-6">
            <li>
              <h3 className="text-gold font-medium mb-1">1. Ideation</h3>
              <p className="text-foreground/70 text-sm leading-relaxed">
                No need to arrive with ideas. We throw them around together, form teams organically, and
                let the best emerge from conversation. Max three-person teams — you don&rsquo;t learn when
                there are too many.
              </p>
            </li>
            <li>
              <h3 className="text-gold font-medium mb-1">2. Building</h3>
              <p className="text-foreground/70 text-sm leading-relaxed">
                Ship, don&rsquo;t polish. Use AI to collapse timelines from months to hours. Share your
                workflow as you build. Help each other when stuck.
              </p>
            </li>
            <li>
              <h3 className="text-gold font-medium mb-1">3. Deep Focus</h3>
              <p className="text-foreground/70 text-sm leading-relaxed">
                Locked in to get the project deployed. No distractions.
              </p>
            </li>
            <li>
              <h3 className="text-gold font-medium mb-1">4. Demo</h3>
              <p className="text-foreground/70 text-sm leading-relaxed">
                Real deploys, not localhost demos. Show what you built. Open the kimono — share your
                prompts, your .cursor files, your agent traces. The trace is the lesson.
              </p>
            </li>
          </ol>
        </section>

        {/* What We Build */}
        <section className="mb-14">
          <h2 className="font-serif text-2xl font-semibold mb-4">What We Build</h2>
          <p className="text-foreground/80 leading-relaxed mb-4">
            Software projects using the latest AI tools. Period.
          </p>
          <ul className="space-y-3 text-foreground/80 text-sm leading-relaxed">
            <li>
              <span className="text-gold font-medium">Master AI Tools —</span>{" "}
              We explore, share, and understand the latest tools. We collapse timelines from months to hours.
            </li>
            <li>
              <span className="text-gold font-medium">Share the Traces —</span>{" "}
              We share prompts, best practices, and .cursor files. The real value isn&rsquo;t just the final
              product — it&rsquo;s the trace of human guidance that got it there.
            </li>
            <li>
              <span className="text-gold font-medium">Grow Together —</span>{" "}
              Meet top-tier engineers, share knowledge, and collectively level up.
            </li>
          </ul>
        </section>

        {/* The Details */}
        <section className="mb-14">
          <h2 className="font-serif text-2xl font-semibold mb-4">The Details</h2>
          <ul className="space-y-3 text-foreground/80 text-sm leading-relaxed">
            <li>
              <span className="text-gold font-medium">No Sponsors.</span>{" "}
              If we think a tool helps us build better, we pay for it ourselves. Pure incentives.
            </li>
            <li>
              <span className="text-gold font-medium">Weekly Hacking.</span>{" "}
              Every Sunday (Sundai) for building sessions.
            </li>
            <li>
              <span className="text-gold font-medium">Retreats Every 8 Weeks.</span>{" "}
              A hike, a weekend trip — whatever helps us bond and recharge.
            </li>
            <li>
              <span className="text-gold font-medium">Self-Funded.</span>{" "}
              Bring your laptop, your ideas, and your energy. Everything else is optional.
            </li>
          </ul>
        </section>

        {/* Who Should Join */}
        <section className="mb-14">
          <h2 className="font-serif text-2xl font-semibold mb-4">Who Should Join</h2>
          <ul className="space-y-2 text-foreground/80 text-sm leading-relaxed mb-4">
            <li>— You love building for the sake of building</li>
            <li>— You want to push AI tools to their limits</li>
            <li>— You value speed over perfection</li>
          </ul>
          <p className="text-foreground/60 text-sm italic">
            It&rsquo;s for people who would build even if no one was watching.
          </p>
        </section>

        {/* CTA */}
        <section className="border-t border-border/50 pt-12 text-center">
          <p className="font-serif text-2xl font-semibold text-foreground mb-2">
            No logos. Just hackers, AI tools, and the pure thrill of building something real.
          </p>
          <p className="text-gold mt-4 text-lg font-medium">This Sundai. Are you in?</p>
        </section>
      </main>

    </FlashlightBackground>
  );
}
