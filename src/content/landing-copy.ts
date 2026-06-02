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
    tagline: "Make something you need",
  },

  sections: [
    {
      id: "manifesto",
      heading: "Engineering\nGym",
      blocks: [
        { type: "statement", text: "For those who solve their own problems." },
        { type: "statement", text: "For those who learn by doing." },
        { type: "statement", text: "For those who trade *candid* feedback." },
        { type: "statement", text: "For those sharpened by like-minded peers.", tone: "gold" },
      ],
    },
    {
      id: "builder-path",
      heading: "Scratch\nyour Own Itch",
      blocks: [
        { type: "call-response", prompt: "That product you wish existed?", answer: "Build it." },
        { type: "call-response", prompt: "That shitty software that keeps fighting you?", answer: "Conquer it." },
        { type: "call-response", prompt: "That idea that keeps nagging you?", answer: "Try it." },
        { type: "statement", text: "If others need it too, even ***better***." },
        { type: "statement", text: "No one will solve\nyour problems\nyour way", tone: "gold" },
      ],
    },
  ],

  nights: {
    heading: "Every Saturday\nFour Hours",
    steps: [
      { num: "01", title: "Arrive", time: "4:00", desc: "Ready to build." },
      { num: "02", title: "Build", time: "8:00", desc: "Heads down." },
      { num: "03", title: "Demo", time: "8:00+", desc: "What you have." },
    ],
  },

  principles: [
    { title: "No BS", desc: "Only what works and how." },
    { title: "No Sponsors", desc: "Only us making shit." },
    { title: "No Excuses", desc: "Only unbridled ambition." },
  ],

  cta: {
    prompt: "",
    label: "Are you ready?",
    footer: "Master yourself.\nMaster AI.",
  },
};
