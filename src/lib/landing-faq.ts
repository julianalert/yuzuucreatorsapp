export const LANDING_FAQ = [
  {
    q: "How much of my time is this, really?",
    a: "About twenty minutes, split across two sittings a few hours apart. Two minutes to hand over your handle, five to pick the idea, and roughly fifteen to read three sample plans properly. If you skim the samples, don't do this.",
  },
  {
    q: "Do you post as me, or touch my account?",
    a: "No. We read your public posts and comments. We never log in as you, never message anyone, never publish anything on your account.",
  },
  {
    q: "What if I hate what you build?",
    a: "Say so and give us one sentence about why. It rebuilds. Nothing goes live without you approving three real samples — and if you never approve, nothing ever goes live and you've paid nothing.",
  },
  {
    q: "What does my buyer actually receive?",
    a: "A written plan on the web, at a private link, generated from their quiz answers in about ninety seconds. Prose, checklists, week-by-week timelines, tables. They can save it as a PDF from their browser, and the link is emailed to them.",
  },
  {
    q: "Why $27?",
    a: "It's the price where people buy on the spot without asking a partner. You can go higher once you have sales — but the first product should sell, not impress.",
  },
  {
    q: "Can I run more than one product?",
    a: "One per creator for now. We'd rather have one that sells than three that half-work.",
  },
  {
    q: "Who's behind this?",
    a: "A small team that built this exact funnel by hand, repeatedly, before turning it into a product. That's why the quality checks are strict — we know precisely where these things go wrong.",
  },
] as const;

export function faqPageJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: LANDING_FAQ.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
  };
}
