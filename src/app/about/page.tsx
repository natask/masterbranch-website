"use client";

import { Nav } from "@/components/nav";
import { aboutCopy } from "@/content/about-copy";
import type { ResponsiveCopy } from "@/content/copy-types";
import Link from "next/link";

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

export default function AboutPage() {
  return (
    <div className="min-h-screen">
      <Nav />

      <main className="mx-auto max-w-2xl px-5 py-16 sm:px-6 sm:py-24">
        <header className="mb-14 sm:mb-20">
          <h1 className="font-cinzel text-3xl font-bold leading-[1.1] tracking-wide sm:text-5xl md:text-6xl">
            <span className="text-gold-shimmer">The Master</span>
            <br />
            <span className="text-white">Branch</span>
          </h1>
          <p className="mt-5 text-base leading-relaxed text-white/70 sm:mt-6 sm:text-lg">
            <CopyText copy={aboutCopy.hero.subtitle} />
          </p>
        </header>

        <section className="mb-14 space-y-5 text-white/75 leading-relaxed">
          {aboutCopy.intro.map((paragraph) => (
            <p key={paragraph.desktop}>
              <CopyText copy={paragraph} />
            </p>
          ))}
        </section>

        <section className="mb-14 space-y-8 text-white/75 leading-relaxed">
          {aboutCopy.sections.map((section) => (
            <div key={section.heading} className="space-y-4">
              <h2 className="font-cinzel text-xl text-white/90 tracking-wide">{section.heading}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph.desktop}>
                  <CopyText copy={paragraph} />
                </p>
              ))}
            </div>
          ))}
          <p className="font-cinzel text-white/90 tracking-wide">
            <CopyText copy={aboutCopy.accent} />
          </p>
        </section>

        <section className="mb-14">
          <p className="text-white/75 leading-relaxed mb-6">
            <CopyText copy={aboutCopy.schedule.lead} />
            <Link
              href={aboutCopy.schedule.inspirationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold underline-offset-4 hover:underline"
            >
              {aboutCopy.schedule.inspirationLabel}
            </Link>
            .
          </p>
          <ol className="space-y-5">
            {aboutCopy.schedule.steps.map((s) => (
              <li key={s.n}>
                <h3 className="text-gold font-medium mb-1">
                  {s.n} - {s.title}{" "}
                  <span className="text-white/30 font-normal text-xs">{s.time}</span>
                </h3>
                <p className="text-white/60 text-sm leading-relaxed">
                  <CopyText copy={s.body} />
                </p>
              </li>
            ))}
          </ol>
          <p className="mt-8 text-white/50 text-sm">
            <CopyText copy={aboutCopy.schedule.note} />
          </p>
        </section>

        <section className="mb-14 space-y-3 text-sm">
          {aboutCopy.principles.map((principle) => (
            <p key={principle.title}>
              <span className="text-gold font-medium">{principle.title} </span>
              <span className="text-white/60">{principle.body}</span>
            </p>
          ))}
        </section>

        <section className="border-t border-border/50 pt-10 sm:pt-12">
          <p className="text-white font-cinzel tracking-wide mb-3">{aboutCopy.closing.heading}</p>
          <p className="text-white/50 text-sm mb-6">{aboutCopy.closing.subheading}</p>
          <a
            href={aboutCopy.closing.handleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gold hover:underline underline-offset-4 text-sm"
          >
            {aboutCopy.closing.handle}
          </a>
        </section>
      </main>
    </div>
  );
}
