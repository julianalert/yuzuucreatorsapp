import { describe, it, expect } from "vitest";
import { validateBlueprint, validateGeneratedOutput, flattenGeneratedOutput } from "./validate";
import type { Blueprint, GeneratedOutput, OutputTemplate } from "./types";

/** A minimal valid blueprint in the per-user generation shape. */
function goldenBlueprint(): Blueprint {
  const template: OutputTemplate = {
    doc_label: "Calm Walks",
    cover_label: "Personalized Loose-Lead Plan",
    fingerprint_title: "Your walk, measured",
    fingerprint_axes: ["pulling", "reactivity", "arousal", "time budget", "history"],
    sections: [
      {
        id: "diagnosis",
        eyebrow: "Part 01 · Diagnosis",
        title: "Why your dog pulls",
        description: "Your situation decoded",
        accent: "rose",
        component: "cards",
        instructions: "Explain the root causes this buyer's answers point to.",
      },
      {
        id: "plan",
        eyebrow: "Part 02 · The plan",
        title: "The 21 days",
        accent: "sage",
        component: "timeline",
        instructions: "Phase the work to the buyer's stated time budget.",
      },
      {
        id: "reference",
        eyebrow: "Part 03 · Reference",
        title: "Priority table",
        accent: "amber",
        component: "table",
        table_columns: ["Change", "Why", "When"],
        instructions: "Prioritize for this buyer's severity.",
      },
      {
        id: "daily",
        eyebrow: "Part 04 · Daily",
        title: "The daily rhythm",
        accent: "zest",
        component: "rhythm",
        instructions: "Fit the buyer's stated schedule.",
      },
    ],
  };

  return {
    blueprint_id: "bp_test_v1",
    blueprint_version: 1,
    status: "complete",
    creator: {
      handle: "pawcraft",
      audience_card: {
        who: "Dog owners with pullers",
        core_promise: "Calm walks",
        vocabulary: [],
        audience_words: [],
        objections: [],
        tone_notes: "",
        credibility_basis: "",
        confidence: { who: 0.9 },
      },
    },
    product: { topic_title: "Calm Walks in 21 Days", promise: "Loose lead", duration_days: 21, price_usd: 27 },
    knowledge_pack: {
      root_causes: [
        { id: "rc_arousal", label: "Over-arousal at the door", prevalence: "high", explanation: "The walk starts at 10/10." },
      ],
      mechanisms: [
        { id: "mech_threshold", name: "Threshold work", why_it_works: "Learning happens under threshold." },
      ],
      false_beliefs: [{ belief: "Tired dog = calm dog", correction: "Different states." }],
      glossary: { threshold: "the point past which learning stops" },
    },
    quiz: {
      questions: [
        { id: "q_age", question: "How old is your dog?", type: "single", required: true, informs: ["diagnosis", "plan"],
          options: [{ value: "pup", label: "Under 1" }, { value: "adult", label: "1-7" }] },
        { id: "q_pull", question: "When does the pulling happen?", type: "single", required: true, informs: ["diagnosis"],
          options: [{ value: "start", label: "First minutes" }, { value: "whole", label: "The whole walk" }] },
        { id: "q_react", question: "Other dogs nearby?", type: "single", required: true, informs: ["diagnosis", "reference"],
          options: [{ value: "lunges", label: "Lunges" }, { value: "fine", label: "Fine" }] },
        { id: "q_time", question: "Training time per day?", type: "single", required: true, informs: ["plan", "daily"],
          options: [{ value: "10", label: "10 minutes" }, { value: "30", label: "30 minutes" }] },
        { id: "q_tried", question: "What have you tried?", type: "multi", required: true, informs: ["diagnosis", "reference"],
          options: [{ value: "harness", label: "No-pull harness" }, { value: "trainer", label: "A trainer" }] },
        { id: "q_context", question: "Where do you walk?", type: "single", required: true, informs: ["daily", "plan"],
          options: [{ value: "city", label: "City streets" }, { value: "quiet", label: "Quiet roads" }] },
      ],
    },
    output: {
      template,
      generation_prompt:
        "1. Every section must visibly use the buyer's answers. BAD: 'many dogs pull'. GOOD: 'your 14-month-old pulls hardest in the first five minutes, which points to door-arousal'. " +
        "2. Derive the diagnosis only from root causes the answers point to. 3. Cite mechanisms. 4. Time budget is a hard limit. QUALITY CHECKLIST: personalized? cited? within budget?",
      voice: { reading_level: "grade 8", person: "second", banned_phrases: ["unlock"] },
    },
    safety: { domain_risk_tier: "low", disclaimers: [], banned_claims: [], escalation_triggers: [] },
    eval: {
      rubric: [{ id: "specificity", weight: 0.5, fail_below: 7 }],
      swap_test: { min_divergence_pct: 40 },
      thresholds: { min_weighted_score: 7.5 },
    },
  };
}

function goldenOutput(): GeneratedOutput {
  return {
    cover: {
      title: "Your Calm-Walks Plan",
      subtitle: "For a 14-month-old who pulls the first five minutes",
      fingerprint: [8, 3, 9, 4, 6],
      meta: [{ value: "21 days", label: "Duration" }],
    },
    sections: {
      diagnosis: {
        callout: { label: "Your situation", body: "Your dog pulls hardest at the start." },
        intro: ["The first minutes tell us this is arousal, not disobedience."],
        cards: [
          { kicker: "CAUSE 01", title: "Door arousal", body: "He leaves the house at 10/10.", tag: "primary" },
          { kicker: "CAUSE 02", title: "Rehearsed pulling", body: "Every pulled step pays off.", tag: "secondary" },
        ],
      },
      plan: {
        callout: { label: "Pacing", body: "Built for your 10 minutes a day." },
        timeline: [
          { marker: "1", range: "Days 1-7", title: "Lower the exit arousal", body: "Work the doorway ritual." },
          { marker: "2", range: "Days 8-21", title: "Pay the slack", body: "Reinforce every loose-lead step." },
        ],
      },
      reference: {
        callout: { label: "Priorities", body: "Ordered for a start-of-walk puller." },
        table: {
          rows: [
            { cells: ["Doorway ritual", "Cuts the arousal spike", "Today"], badge: "high" },
            { cells: ["Sniff breaks", "Decompresses mid-walk", "Week 2"], badge: "medium" },
          ],
        },
      },
      daily: {
        callout: { label: "Your day", body: "Fits a city morning schedule." },
        rhythm: [
          { time: "07:00", title: "Doorway ritual", desc: "Two minutes before the lead goes on." },
          { time: "07:10", title: "First block", desc: "Pay every loose step." },
          { time: "18:00", title: "Sniff walk", desc: "No training, just decompression." },
        ],
      },
    },
  };
}

describe("validateBlueprint", () => {
  it("passes the golden blueprint clean", () => {
    const res = validateBlueprint(goldenBlueprint());
    expect(res.errors).toEqual([]);
    expect(res.ok).toBe(true);
  });

  it("fails a question that informs no section", () => {
    const bp = goldenBlueprint();
    bp.quiz.questions[0].informs = [];
    const res = validateBlueprint(bp);
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => e.path.includes(bp.quiz.questions[0].id))).toBe(true);
  });

  it("fails a question that informs an unknown section", () => {
    const bp = goldenBlueprint();
    bp.quiz.questions[0].informs = ["nonexistent_section"];
    const res = validateBlueprint(bp);
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => e.issue.includes('"nonexistent_section"'))).toBe(true);
  });

  it("warns (not errors) when a section is informed by no question", () => {
    const bp = goldenBlueprint();
    for (const q of bp.quiz.questions) {
      q.informs = q.informs?.filter((s) => s !== "reference");
      if (!q.informs?.length) q.informs = ["diagnosis"];
    }
    const res = validateBlueprint(bp);
    expect(res.ok).toBe(true);
    expect(res.warnings.some((w) => w.path.includes("reference"))).toBe(true);
  });

  it("fails a missing generation prompt", () => {
    const bp = goldenBlueprint();
    bp.output.generation_prompt = "";
    const res = validateBlueprint(bp);
    expect(res.errors.some((e) => e.path === "output.generation_prompt")).toBe(true);
  });

  it("fails a template with too few sections", () => {
    const bp = goldenBlueprint();
    bp.output.template.sections = bp.output.template.sections.slice(0, 2);
    const res = validateBlueprint(bp);
    expect(res.errors.some((e) => e.path === "output.template.sections")).toBe(true);
  });

  it("fails a table section without valid columns", () => {
    const bp = goldenBlueprint();
    const table = bp.output.template.sections.find((s) => s.component === "table")!;
    table.table_columns = ["only-one"];
    const res = validateBlueprint(bp);
    expect(res.errors.some((e) => e.path.includes("table_columns"))).toBe(true);
  });

  it("rejects approved status without an approval record", () => {
    const bp = goldenBlueprint();
    bp.status = "approved";
    const res = validateBlueprint(bp);
    expect(res.errors.some((e) => e.path === "status")).toBe(true);
  });

  it("requires disclaimers for high-risk domains", () => {
    const bp = goldenBlueprint();
    bp.safety.domain_risk_tier = "high";
    bp.safety.disclaimers = [];
    const res = validateBlueprint(bp);
    expect(res.errors.some((e) => e.path === "safety.disclaimers")).toBe(true);
  });

  it("rejects quizzes under 6 questions", () => {
    const bp = goldenBlueprint();
    bp.quiz.questions = bp.quiz.questions.slice(0, 3);
    const res = validateBlueprint(bp);
    expect(res.errors.some((e) => e.path === "quiz.questions")).toBe(true);
  });
});

describe("validateGeneratedOutput", () => {
  it("passes the golden output clean", () => {
    const bp = goldenBlueprint();
    const res = validateGeneratedOutput(bp.output.template, goldenOutput());
    expect(res.errors).toEqual([]);
    expect(res.ok).toBe(true);
  });

  it("fails a missing section", () => {
    const bp = goldenBlueprint();
    const out = goldenOutput();
    delete out.sections.plan;
    const res = validateGeneratedOutput(bp.output.template, out);
    expect(res.errors.some((e) => e.path === "sections.plan")).toBe(true);
  });

  it("fails a fingerprint of the wrong length", () => {
    const bp = goldenBlueprint();
    const out = goldenOutput();
    out.cover.fingerprint = [5, 5];
    const res = validateGeneratedOutput(bp.output.template, out);
    expect(res.errors.some((e) => e.path === "cover.fingerprint")).toBe(true);
  });

  it("fails a section whose content doesn't match its component shape", () => {
    const bp = goldenBlueprint();
    const out = goldenOutput();
    out.sections.diagnosis.cards = [];
    const res = validateGeneratedOutput(bp.output.template, out);
    expect(res.errors.some((e) => e.path === "sections.diagnosis")).toBe(true);
  });

  it("fails table rows with the wrong width", () => {
    const bp = goldenBlueprint();
    const out = goldenOutput();
    out.sections.reference.table = { rows: [{ cells: ["too", "few"] }, { cells: ["also", "few"] }] };
    const res = validateGeneratedOutput(bp.output.template, out);
    expect(res.errors.some((e) => e.path === "sections.reference")).toBe(true);
  });
});

describe("flattenGeneratedOutput", () => {
  it("flattens every section to non-empty text", () => {
    const bp = goldenBlueprint();
    const flat = flattenGeneratedOutput(bp.output.template, goldenOutput());
    expect(Object.keys(flat).sort()).toEqual(["daily", "diagnosis", "plan", "reference"]);
    for (const text of Object.values(flat)) {
      expect(text.length).toBeGreaterThan(20);
    }
    expect(flat.diagnosis).toContain("Door arousal");
    expect(flat.reference).toContain("Doorway ritual");
  });
});
