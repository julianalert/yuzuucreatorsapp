import type { RubricDimension, SkeletonSection, Voice } from "../blueprint/types";

/**
 * The product skeleton (transformation-plan archetype). The four phase
 * sections keep their `week_*` ids for structural stability (quiz `drives`,
 * EVAL_SECTIONS, content-bank keys), but their titles and day ranges adapt
 * to the plan duration the model chose for the topic.
 */
export function skeletonFor(durationDays?: number): SkeletonSection[] {
  const phases: SkeletonSection[] = [0, 1, 2, 3].map((i) => {
    let title = `Part ${i + 1}`; // non-time-boxed products (bonus ideas)
    if (durationDays) {
      const start = Math.round((i * durationDays) / 4) + 1;
      const end = Math.round(((i + 1) * durationDays) / 4);
      const isWeekly = durationDays >= 28 && durationDays <= 31;
      title = isWeekly ? `Week ${i + 1}` : `Days ${start}–${end}`;
    }
    return { id: `week_${i + 1}`, title, target_words: 700 };
  });
  return [
    { id: "diagnosis", title: "What's actually going on", target_words: 350 },
    { id: "mechanism", title: "Why what you've tried hasn't stuck", target_words: 300 },
    ...phases,
    { id: "troubleshooting", title: "When it goes sideways", target_words: 500 },
    { id: "regression", title: "If you lose ground", target_words: 250 },
  ];
}

/** 30-day skeleton — fallback for blueprints/tests that predate variable durations. */
export const SKELETON: SkeletonSection[] = skeletonFor(30);

export const RUBRIC: RubricDimension[] = [
  { id: "specificity", weight: 0.3, fail_below: 7 },
  { id: "actionability", weight: 0.25, fail_below: 7 },
  { id: "mechanism", weight: 0.2, fail_below: 6 },
  { id: "voice_match", weight: 0.15, fail_below: 6 },
  { id: "claims_safety", weight: 0.1, fail_below: 9 },
];

export const MIN_SCORE = 7.5;
export const MIN_DIVERGENCE = 40;

/** Sections rendered for evaluation. Rendering all 8 × N archetypes is wasteful at build time. */
export const EVAL_SECTIONS = ["diagnosis", "week_1", "troubleshooting"];

/** How many transformation ideas the creator sees (a bonus wild card is added separately). */
export const TOPIC_COUNT = 3;

export const DEFAULT_PRICE_CENTS = 2700;

export function defaultVoice(toneNotes?: string): Voice {
  return {
    reading_level: "grade 8",
    person: "second",
    banned_phrases: ["unlock", "game-changer", "In today's world", "journey", "dive in"],
    tone_notes: toneNotes,
  };
}
