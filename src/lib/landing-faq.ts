export const LANDING_FAQ = [
  {
    q: "What is Yuzuu, in one sentence?",
    a: "The platform that takes a client request from the first message to the paid invoice. It collects the details, prices standard jobs by your rules, books the right slot, follows up quotes, reminds clients and collects payment, so you only step in where your expertise is needed.",
  },
  {
    q: "When can I start using it?",
    a: "We’re opening early access in waves, trade by trade, so every business gets proper attention at setup. Join the waitlist and you’ll get one email when your spot opens. Nothing before that.",
  },
  {
    q: "Does the AI set my prices or promise dates?",
    a: "No. The AI understands requests and handles the conversation. Prices come from rules you define (size, options, zone, urgency), slots come from your real calendar, and anything sensitive (a quote over your limit, a discount, a refund) waits for your OK.",
  },
  {
    q: "I sell fixed-price jobs and quoted projects. Does it handle both?",
    a: "Yes. You choose the journey per service, not per trade. A heating business can sell an annual service at a fixed price, handle breakdowns with a paid diagnosis, and quote installations, all from the same account.",
  },
  {
    q: "What if a client wants to talk to a real person?",
    a: "They can. Agents hand the conversation to you with the full context: what was asked, what was answered, the photos and the address. You never start from “sorry, can you repeat that?”",
  },
  {
    q: "Will it replace the tools I already use?",
    a: "That’s the plan: one client record, one case tracker, one calendar, quotes, payments and a client space, in a single place. Bring your existing client list with you.",
  },
  {
    q: "How much will it cost?",
    a: "Pricing will be published before early access opens, and people on the waitlist will see it first. Joining the waitlist is free and commits you to nothing.",
  },
  {
    q: "Who owns my client data?",
    a: "You do. Your clients, your history, your photos and documents stay yours and can be exported whenever you want.",
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
