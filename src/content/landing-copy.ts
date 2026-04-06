import type { ResponsiveCopy } from "@/content/copy-types";

type LandingScheduleStep = {
  num: string;
  title: string;
  time: string;
  text: ResponsiveCopy;
};

type LandingPrinciple = {
  title: string;
  desc: string;
};

type LandingCopy = {
  actions: {
    challengePrompt: string;
    joinLabel: string;
  };
  hero: {
    location: string;
    tagline: ResponsiveCopy;
  };
  manifesto: Array<{
    heading: ResponsiveCopy;
    paragraphs: ResponsiveCopy[];
    accent: ResponsiveCopy;
  }>;
  nights: {
    heading: ResponsiveCopy;
    steps: LandingScheduleStep[];
  };
  principles: LandingPrinciple[];
  closing: {
    heading: string;
    footer: string;
  };
};

export const landingCopy: LandingCopy = {
  actions: {
    challengePrompt: "Think you belong?",
    joinLabel: "Prove it.",
  },
  hero: {
    location: "San Francisco",
    tagline: "Build what you need.",
  },
  manifesto: [
    {
      heading: "Engineers' Gym",
      paragraphs: [
        "For those who solve their problems.",
        "For those who make their ideas real.",
        "For those who trade candid feedback.",
        "For those who learn by doing.",
        "For those who crave the company of peers.",
      ],
      accent: "",
    },
    {
      heading: "Scratch your own itch",
      paragraphs: [
        "Software annoying you?\nClone it.",
        "Workflow broken?\nFix it.",
        "Tool missing?\nBuild it.",
        "If others need it too, even better.",
      ],
      accent: "No one is going to solve your problems your way.",
    },
  ],
  nights: {
    heading: "Every day.\n6 - 10pm",
    steps: [
      {
        num: "01",
        title: "Arrive",
        time: "6:00",
        text: "Ready to build.",
      },
      {
        num: "02",
        title: "Build",
        time: "10:00",
        text: "Heads down.",
      },
      {
        num: "03",
        title: "Demo",
        time: "10:00+",
        text: "What you have.",
      },
    ],
  },
  principles: [
    { title: "No BS", desc: "Only what was built and how." },
    { title: "No Sponsors", desc: "Only us paying for our own tools." },
    { title: "No Excuses", desc: "Only unbounded ambition." },
  ],
  closing: {
    heading: "",
    footer: "Master yourself. Master AI.",
  },
};
