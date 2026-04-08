/* ── block types ──────────────────────────────────────── */

export type StatementBlock = {
  type: "statement";
  text: string;
  tone?: "default" | "gold" | "muted";
};

export type CallResponseBlock = {
  type: "call-response";
  prompt: string;
  answer: string;
};

export type AccentBlock = {
  type: "accent";
  text: string;
};

export type ContentBlock = StatementBlock | CallResponseBlock | AccentBlock;

export type ScheduleStep = {
  num: string;
  title: string;
  time: string;
  desc: string;
};

export type Principle = {
  title: string;
  desc: string;
};

export type ContentSection = {
  id: string;
  heading: string;
  blocks: ContentBlock[];
};

export type LandingCopy = {
  hero: {
    location: string;
    tagline: string;
  };
  sections: ContentSection[];
  nights: {
    heading: string;
    steps: ScheduleStep[];
  };
  principles: Principle[];
  cta: {
    prompt: string;
    label: string;
    footer: string;
  };
};

/* ── copy ─────────────────────────────────────────────── */

export const landingCopy: LandingCopy = {
  hero: {
    location: "San Francisco",
    tagline: "Build what you need.",
  },

  sections: [
    {
      id: "manifesto",
      heading: "Engineering\nGym",
      blocks: [
        { type: "statement", text: "For those who solve their problems." },
        { type: "statement", text: "For those who make their ideas real." },
        { type: "statement", text: "For those who trade *candid* feedback." },
        { type: "statement", text: "For those who learn by doing." },
        { type: "statement", text: "For those who crave the company of peers", tone: "gold" },
      ],
    },
    {
      id: "builder-path",
      heading: "Scratch\nyour own itch",
      blocks: [
        { type: "call-response", prompt: "Software annoying you?", answer: "Clone it." },
        { type: "call-response", prompt: "Workflow broken?", answer: "Fix it." },
        { type: "call-response", prompt: "Tool missing?", answer: "Build it." },
        { type: "statement", text: "If others need it too, even ***better***." },
        { type: "statement", text: "No one else will solve\nyour problems\nyour *way*", tone: "gold" },
      ],
    },
  ],

  nights: {
    heading: "Every day\nFour Hours",
    steps: [
      { num: "01", title: "Arrive", time: "6:00", desc: "Ready to build." },
      { num: "02", title: "Build", time: "10:00", desc: "Heads down." },
      { num: "03", title: "Demo", time: "10:00+", desc: "What you have." },
    ],
  },

  principles: [
    { title: "No BS", desc: "Only what was built and how." },
    { title: "No Sponsors", desc: "Only us paying for our own tools." },
    { title: "No Excuses", desc: "Only unbridled ambition." },
  ],

  cta: {
    prompt: "Are you ready?",
    label: "Prove it.",
    footer: "Master yourself.\nMaster AI.",
  },
};
