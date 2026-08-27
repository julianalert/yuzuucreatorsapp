import type { RubricDimension, Voice } from "../blueprint/types";

export const RUBRIC: RubricDimension[] = [
  { id: "specificity", weight: 0.3, fail_below: 7 },
  { id: "actionability", weight: 0.25, fail_below: 7 },
  { id: "mechanism", weight: 0.2, fail_below: 6 },
  { id: "voice_match", weight: 0.15, fail_below: 6 },
  { id: "claims_safety", weight: 0.1, fail_below: 9 },
];

export const MIN_SCORE = 7.5;

/**
 * Minimum bigram divergence between two synthetic buyers' sample documents.
 * With fully per-buyer generation this is the "personalization is real" gate:
 * three deliberately different personas must produce materially different
 * documents.
 */
export const MIN_DIVERGENCE = 40;

/** How many synthetic buyers get full sample documents at build time. */
export const SAMPLE_BUYER_COUNT = 3;

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
