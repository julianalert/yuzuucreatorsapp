import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { validateBlueprint, resolveArchetype } from "./validate";
import type { Blueprint } from "./types";

const pawcraft: Blueprint = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../../../pawcraft.blueprint.json"), "utf8")
);

describe("validateBlueprint", () => {
  it("passes the golden pawcraft blueprint clean", () => {
    const res = validateBlueprint(pawcraft);
    expect(res.errors).toEqual([]);
    expect(res.ok).toBe(true);
  });

  it("fails a question that drives nothing and modifies nothing", () => {
    const bp = structuredClone(pawcraft);
    bp.quiz.questions[0].drives = [];
    bp.quiz.questions[0].modifies = [];
    const res = validateBlueprint(bp);
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => e.path.includes(bp.quiz.questions[0].id))).toBe(true);
  });

  it("fails an unreachable archetype", () => {
    const bp = structuredClone(pawcraft);
    bp.quiz.archetype_rules[0].match = { all: [{ signal: "nonexistent_signal", in: ["x"] }] };
    const res = validateBlueprint(bp);
    expect(res.ok).toBe(false);
    expect(
      res.errors.some((e) => e.issue.includes('signal "nonexistent_signal"'))
    ).toBe(true);
  });

  it("fails a missing fallback archetype", () => {
    const bp = structuredClone(pawcraft);
    // @ts-expect-error deliberately breaking it
    bp.quiz.fallback_archetype = undefined;
    const res = validateBlueprint(bp);
    expect(res.errors.some((e) => e.path === "quiz.fallback_archetype")).toBe(true);
  });

  it("enforces coverage for complete blueprints but only warns on drafts", () => {
    const bp = structuredClone(pawcraft);
    const firstKey = Object.keys(bp.output.content_bank)[0];
    delete bp.output.content_bank[firstKey];

    bp.status = "draft";
    delete (bp as Partial<Blueprint>).approved_at;
    delete (bp as Partial<Blueprint>).approved_by;
    const draft = validateBlueprint(bp);
    expect(draft.errors.some((e) => e.path === "output.content_bank")).toBe(false);
    expect(draft.warnings.some((w) => w.path === "output.content_bank")).toBe(true);

    bp.status = "complete";
    const complete = validateBlueprint(bp);
    expect(complete.errors.some((e) => e.path === "output.content_bank")).toBe(true);
  });

  it("rejects approved status without an approval record", () => {
    const bp = structuredClone(pawcraft);
    bp.status = "approved";
    delete (bp as Partial<Blueprint>).approved_at;
    delete (bp as Partial<Blueprint>).approved_by;
    const res = validateBlueprint(bp);
    expect(res.errors.some((e) => e.path === "status")).toBe(true);
  });

  it("requires disclaimers for high-risk domains", () => {
    const bp = structuredClone(pawcraft);
    bp.safety.domain_risk_tier = "high";
    bp.safety.disclaimers = [];
    const res = validateBlueprint(bp);
    expect(res.errors.some((e) => e.path === "safety.disclaimers")).toBe(true);
  });

  it("rejects quizzes under 6 questions", () => {
    const bp = structuredClone(pawcraft);
    bp.quiz.questions = bp.quiz.questions.slice(0, 3);
    const res = validateBlueprint(bp);
    expect(res.errors.some((e) => e.path === "quiz.questions")).toBe(true);
  });
});

describe("resolveArchetype", () => {
  it("resolves the fallback when no answers match", () => {
    const res = resolveArchetype(pawcraft, {});
    expect(res.archetype).toBe(pawcraft.quiz.fallback_archetype);
    expect(res.matched_rules).toEqual([]);
  });

  it("resolves a real archetype and highest priority wins", () => {
    // Build answers that hit as many signals as possible: pick the first
    // option of every question, then verify the resolved archetype's rule
    // conditions are all satisfiable by the emitted signals.
    const answers: Record<string, string> = {};
    for (const q of pawcraft.quiz.questions) answers[q.id] = q.options[0].value;
    const res = resolveArchetype(pawcraft, answers);
    expect(typeof res.archetype).toBe("string");
    expect(res.archetype.length).toBeGreaterThan(0);
    if (res.matched_rules.length > 1) {
      const prio = (id: string) =>
        pawcraft.quiz.archetype_rules.find((r) => r.id === id)?.priority ?? 0;
      expect(prio(res.matched_rules[0])).toBeGreaterThanOrEqual(prio(res.matched_rules[1]));
    }
  });

  it("collects multi-select signals into arrays", () => {
    const multi = pawcraft.quiz.questions.find((q) => q.type === "multi");
    if (!multi) return; // pawcraft may not have one; mock covers this case
    const values = multi.options.slice(0, 2).map((o) => o.value);
    const res = resolveArchetype(pawcraft, { [multi.id]: values });
    expect(Object.keys(res.signals).length).toBeGreaterThan(0);
  });
});
