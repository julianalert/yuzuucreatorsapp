import type { RubricDimension, SkeletonSection, Voice } from "../blueprint/types";

/** The uniform product skeleton — same for every creator (transformation-plan archetype). */
export const SKELETON: SkeletonSection[] = [
  { id: "diagnosis", title: "What's actually going on", target_words: 350 },
  { id: "mechanism", title: "Why what you've tried hasn't stuck", target_words: 300 },
  { id: "week_1", title: "Week 1", target_words: 700 },
  { id: "week_2", title: "Week 2", target_words: 700 },
  { id: "week_3", title: "Week 3", target_words: 700 },
  { id: "week_4", title: "Week 4", target_words: 700 },
  { id: "troubleshooting", title: "When it goes sideways", target_words: 500 },
  { id: "regression", title: "If you lose ground", target_words: 250 },
];

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

/** How many ideas the creator sees. */
export const TOPIC_COUNT = 5;

export const DEFAULT_PRICE_CENTS = 2700;

export function defaultVoice(toneNotes?: string): Voice {
  return {
    reading_level: "grade 8",
    person: "second",
    banned_phrases: ["unlock", "game-changer", "In today's world", "journey", "dive in"],
    tone_notes: toneNotes,
  };
}
