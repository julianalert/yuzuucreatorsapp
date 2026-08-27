/**
 * Mock stage implementations. Exercises the harness plumbing — validation,
 * gating, swap test, CSV — without spending money or needing a key.
 *
 * Deliberately imperfect: sourdough returns no viable topic, and one creator
 * produces near-identical archetypes so the swap test has something to catch.
 */

const SECTIONS = ["diagnosis", "mechanism", "week_1", "week_2", "week_3", "week_4", "troubleshooting", "regression"];

export const getUsage = () => ({ calls: 0, input: 0, output: 0 });
export const estimateCost = () => 0;

let current = null;

export async function extractAudience(creator) {
  current = creator;
  return {
    who: `Audience of ${creator.handle}.`,
    core_promise: creator.self_description,
    vocabulary: ["threshold", "baseline", "consistency"],
    audience_words: creator.comments.slice(0, 3),
    objections: creator.comments.slice(0, 2),
    tone_notes: "Direct, competent, no fluff.",
    credibility_basis: creator.bio,
    confidence: { who: 0.8, core_promise: 0.85, objections: 0.7 },
  };
}

export async function proposeTopics() {
  if (current.id === "sourdough") return { proposals: [], insufficient: true };
  const seg = current.id === "language_spanish" ? 6 : 8;
  return {
    proposals: [
      {
        topic_title: `The 30-Day ${current.handle} Reset`,
        promise: current.self_description,
        scores: { acuteness: 8, segmentability: seg, resolvability: 7, credibility: 9 },
        why_this_works: "mock",
        segmentation_preview: ["a", "b", "c", "d"],
        risk: "mock",
      },
    ],
  };
}

export async function buildKnowledgePack() {
  return {
    segments: Array.from({ length: 7 }, (_, i) => ({
      id: `seg_${i}`, label: `Segment ${i}`, prevalence: "high", root_cause: `Root cause ${i}`,
    })),
    mechanisms: Array.from({ length: 6 }, (_, i) => ({
      id: `mech_${i}`, name: `Mechanism ${i}`,
      why_it_works: `Causal chain ${i}.`, applies_to_segments: [`seg_${i}`],
    })),
    false_beliefs: [{ belief: "x", correction: "y" }],
    glossary: { threshold: "the point past which it stops working" },
  };
}

export async function designQuiz(pack, audience, skeleton) {
  const archetypes = ["arch_a", "arch_b", "arch_c", "arch_d"];
  const questions = [
    { id: "q_stage", question: "Where are you now?", type: "single", required: true,
      drives: ["diagnosis", "week_1"], modifies: [],
      options: [
        { value: "early", label: "Just starting", signals: { stage: "early" } },
        { value: "stuck", label: "Been stuck a while", signals: { stage: "stuck" } },
      ] },
    { id: "q_cause", question: "What's the main obstacle?", type: "single", required: true,
      drives: ["diagnosis", "mechanism", "troubleshooting"], modifies: [],
      options: [
        { value: "time", label: "No time", signals: { cause: "time" } },
        { value: "method", label: "Tried things that failed", signals: { cause: "method" } },
      ] },
    { id: "q_history", question: "What have you tried?", type: "multi", required: true,
      drives: ["mechanism", "regression"], modifies: [],
      options: [
        { value: "nothing", label: "Nothing structured", signals: { tried: "none" } },
        { value: "lots", label: "Several things", signals: { tried: "lots" } },
      ] },
    { id: "q_budget", question: "How long per day?", type: "single", required: true,
      drives: ["week_1", "week_2", "week_3", "week_4"], modifies: ["constraints", "pacing"],
      options: [
        { value: "5", label: "5 minutes", signals: { budget: 5 } },
        { value: "20", label: "20 minutes", signals: { budget: 20 } },
      ] },
    { id: "q_context", question: "What's your situation?", type: "single", required: true,
      drives: ["week_2", "week_3"], modifies: [],
      options: [
        { value: "solo", label: "On my own", signals: { context: "solo" } },
        { value: "shared", label: "Others involved", signals: { context: "shared" } },
      ] },
    { id: "q_pressure", question: "Any deadline?", type: "single", required: true,
      drives: ["week_4", "regression"], modifies: ["pacing"],
      options: [
        { value: "yes", label: "Yes", signals: { deadline: true } },
        { value: "no", label: "No", signals: { deadline: false } },
      ] },
  ];
  return {
    questions,
    archetype_rules: archetypes.map((id, i) => ({
      id, label: `Archetype ${i}`, priority: 10 + i,
      archetype_rationale: `Differs by ${i}`,
      match: { all: [{ signal: i % 2 ? "cause" : "stage", in: [i % 2 ? "time" : "early"] }] },
    })),
    fallback_archetype: "arch_general",
  };
}

export async function writeBrief({ archetype, section }) {
  return {
    brief: `Brief for ${archetype}, section ${section.id}.`,
    must_include: ["point one", "point two", "point three"],
    must_avoid: ["thing one", "thing two"],
    mechanism_refs: ["mech_0"],
    ...(section.id.startsWith("week") ? { week_theme: "mock theme" } : {}),
  };
}

export async function renderSection({ entry, section, buyer }) {
  // language_spanish produces near-identical archetypes so the swap test fires
  const identical = current.id === "language_spanish";
  const seed = identical ? "shared" : buyer.situation;
  const filler = Array.from({ length: 40 }, (_, i) => `${seed} word${i}`).join(" ");
  return `${entry.brief} ${filler} This is the ${section.id} section for ${seed}.`;
}

export async function knowledgeCritic() {
  return { pass: true, score: 8, failures: [] };
}
export async function quizCritic() {
  return { pass: true, score: 7, failures: [] };
}
export async function outputCritic(archetype) {
  const base = current.id === "budget_debt" ? 6.4 : 7.9;
  return {
    pass: base >= 7.5,
    weighted: base,
    scores: {
      specificity: { score: base - 0.5, why: "mock", evidence: "mock" },
      actionability: { score: base, why: "mock", evidence: "mock" },
      mechanism: { score: base + 0.3, why: "mock", evidence: "mock" },
      voice_match: { score: base + 0.2, why: "mock", evidence: "mock" },
      claims_safety: { score: current.id === "budget_debt" ? 6 : 9.2, why: "mock", evidence: "mock" },
    },
    failures: [],
  };
}
export async function claimsCritic() {
  return { pass: true, score: 9, failures: [] };
}
