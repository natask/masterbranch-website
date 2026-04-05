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
    tagline: {
      desktop: "Build what you need.",
      mobile: "Build what you need.",
    },
  },
  manifesto: [
    {
      heading: {
        desktop: "Engineers' Gym",
        mobile: "Engineers' Gym",
      },
      paragraphs: [
        {
          desktop:
            "For those who solve their problems.",
          mobile:
            "For those who solve their problems.",
        },
        {
          desktop:
            "For those who make their ideas real.",
          mobile:
            "For those who make their ideas real.",
        },
        {
          desktop:
            "For those who trade candid feedback.",
          mobile:
            "For those who trade candid feedback.",
        },
        {
          desktop:
            "For those who learn by doing.",
          mobile:
            "For those who learn by doing.",
        },
        {
          desktop:
            "For those who crave the company of peers.",
          mobile:
            "For those who crave the company of peers.",
        },
      ],
      accent: {
        desktop: "",
      },
    },
    {
      heading: {
        desktop: "",
        mobile: "",
      },
      paragraphs: [
        {
          desktop:
            "Scratch your own itch",
          mobile: "Scratch your own itch",
        },
        {
          desktop:
            "Software annoying you? Clone it.",
          mobile: "Software annoying you? Clone it.",
        },
        {
          desktop:
            "Workflow broken? Fix it.",
          mobile: "Workflow broken? Fix it.",
        },
        {
          desktop:
            "Tool missing? Build it.",
          mobile: "Tool missing? Build it.",
        },
        {
          desktop:
            "If others need it too, even better.",
          mobile: "If others need it too, even better.",
        },
      ],
      accent: {
        desktop: "No one is going to solve your problems your way.",
      },
    },
  ],
  nights: {
    heading: {
      desktop: "Every day. 6 to 10pm",
      mobile: "Every day. 6-10pm",
    },
    steps: [
      {
        num: "01",
        title: "Arrive",
        time: "6:00",
        text: {
          desktop: "Ready to build.",
          mobile: "Ready to build.",
        },
      },
      {
        num: "02",
        title: "Build",
        time: "10:00",
        text: {
          desktop: "Heads down.",
          mobile: "Heads down.",
        },
      },
      {
        num: "03",
        title: "Demo",
        time: "10:00+",
        text: {
          desktop: "Ready to show.",
          mobile: "Ready to show.",
        },
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
