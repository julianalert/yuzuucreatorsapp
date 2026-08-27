import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createMockApi } from "./mock";
import { swapTest, divergence } from "./swap";
import { parseModelJson } from "./ask";
import { SKELETON, RUBRIC, MIN_SCORE, MIN_DIVERGENCE, EVAL_SECTIONS } from "./constants";
import { validateBlueprint } from "../blueprint/validate";
import type { Blueprint, CreatorInput } from "../blueprint/types";

const creators: CreatorInput[] = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../../../harness/creators.json"), "utf8")
);

/** Mirrors harness/run.mjs gating, using the mock api. */
async function runCreator(creator: CreatorInput) {
  const api = createMockApi();
  const audience = await api.extractAudience(creator);
  const minConf = Math.min(...Object.values(audience.confidence ?? { x: 1 }));
  if (minConf < 0.5) return { halted_at: "audience_confidence" };

  const topics = await api.proposeTopics(audience);
  const proposals = topics.proposals ?? [];
  if (!proposals.length) return { halted_at: "no_viable_topic" };
  const chosen = proposals
    .map((p) => ({ p, total: Object.values(p.scores ?? {}).reduce((a, b) => a + b, 0) }))
    .sort((a, b) => b.total - a.total)[0].p;

  const pack = await api.buildKnowledgePack(chosen, audience);
  await api.knowledgeCritic(pack);

  const quiz = await api.designQuiz(pack, audience, SKELETON);
  const voice = { reading_level: "grade 8", person: "second", banned_phrases: ["unlock"] };

  const bp: Blueprint = {
    blueprint_id: `bp_${creator.id}_v1`,
    blueprint_version: 1,
    status: "draft",
    creator: { handle: creator.handle, audience_card: audience },
    product: { topic_title: chosen.topic_title, promise: chosen.promise, duration_days: 30, price_usd: 27 },
    knowledge_pack: pack,
    quiz,
    output: { skeleton: SKELETON, content_bank: {}, voice, personalization_tokens: [] },
    safety: { domain_risk_tier: "low", disclaimers: [], banned_claims: [], escalation_triggers: [] },
    eval: {
      rubric: RUBRIC,
      swap_test: { min_divergence_pct: MIN_DIVERGENCE },
      thresholds: { min_weighted_score: MIN_SCORE },
    },
  };

  const structural = validateBlueprint(bp);
  if (structural.errors.length) return { halted_at: "structural_validation", errors: structural.errors };

  await api.quizCritic(quiz, pack, audience.audience_words ?? []);

  const archetypes = quiz.archetype_rules.slice(0, 4).map((r) => r.id);
  for (const a of archetypes) {
    const rationale = quiz.archetype_rules.find((r) => r.id === a)?.archetype_rationale ?? "";
    const earlier: Record<string, string> = {};
    for (const s of SKELETON.filter((s) => EVAL_SECTIONS.includes(s.id))) {
      const entry = await api.writeBrief({ knowledgePack: pack, archetype: a, rationale, section: s, voice, earlier });
      bp.output.content_bank[`${s.id}::${a}`] = entry;
      earlier[s.id] = entry.brief;
    }
  }

  const renders: Record<string, Record<string, string>> = {};
  for (const a of archetypes) {
    renders[a] = {};
    let prev = "";
    for (const s of SKELETON.filter((s) => EVAL_SECTIONS.includes(s.id))) {
      const entry = bp.output.content_bank[`${s.id}::${a}`];
      const prose = await api.renderSection({
        entry,
        mechanisms: pack.mechanisms ?? [],
        buyer: { situation: a },
        voice,
        section: s,
        previousEnding: prev,
      });
      renders[a][s.id] = prose;
      prev = prose;
    }
  }

  const pairs: [string, string][] = [];
  for (let i = 0; i + 1 < archetypes.length; i += 2) pairs.push([archetypes[i], archetypes[i + 1]]);
  const swap = swapTest(renders, pairs, MIN_DIVERGENCE);
  if (!swap.pass) return { halted_at: "swap_test", divergence: swap.overall };

  const scored: number[] = [];
  for (const a of archetypes) {
    for (const s of EVAL_SECTIONS) {
      const r = await api.outputCritic(a, renders[a][s], RUBRIC);
      scored.push(r.weighted ?? 0);
    }
  }
  const weighted = scored.reduce((t, s) => t + s, 0) / (scored.length || 1);
  return { passed: weighted >= MIN_SCORE, weighted: +weighted.toFixed(2) };
}

const byId = (id: string) => creators.find((c) => c.id === id)!;

describe("mock pipeline gating (mirrors harness run.mjs)", () => {
  it("sourdough is refused at topic proposal — the pipeline saying no is a feature", async () => {
    const r = await runCreator(byId("sourdough"));
    expect(r.halted_at).toBe("no_viable_topic");
  });

  it("language_spanish halts at the swap test — archetypes not materially different", async () => {
    const r = await runCreator(byId("language_spanish"));
    expect(r.halted_at).toBe("swap_test");
  });

  it("budget_debt fails the weighted score gate", async () => {
    const r = await runCreator(byId("budget_debt"));
    expect(r.halted_at).toBeUndefined();
    expect(r.passed).toBe(false);
  });

  it("sleep_toddler (the control) passes", async () => {
    const r = await runCreator(byId("sleep_toddler"));
    expect(r.passed).toBe(true);
    expect(r.weighted).toBeGreaterThanOrEqual(MIN_SCORE);
  });

  it("7 of 10 creators pass, matching the harness baseline", async () => {
    const results = await Promise.all(creators.map((c) => runCreator(c)));
    const passed = results.filter((r) => r.passed).length;
    expect(passed).toBe(7);
  });
});

describe("swap test", () => {
  it("identical texts diverge 0", () => {
    expect(divergence("the same words here", "the same words here")).toBe(0);
  });

  it("disjoint texts diverge 100", () => {
    expect(divergence("alpha beta gamma delta", "one two three four")).toBe(100);
  });

  it("swapTest fails below the threshold and passes above it", () => {
    const renders = {
      a: { diagnosis: "completely different words about dogs pulling on leads" },
      b: { diagnosis: "utterly novel sentences regarding cats and windowsills" },
      c: { diagnosis: "shared words shared words shared words" },
      d: { diagnosis: "shared words shared words shared words" },
    };
    expect(swapTest(renders, [["a", "b"]], 40).pass).toBe(true);
    expect(swapTest(renders, [["c", "d"]], 40).pass).toBe(false);
  });
});

describe("parseModelJson (harness ask() recovery)", () => {
  it("parses clean JSON", () => {
    expect(parseModelJson('{"a":1}')).toEqual({ a: 1 });
  });

  it("strips code fences", () => {
    expect(parseModelJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it("brace-matches JSON embedded in prose", () => {
    expect(parseModelJson('Here is the result:\n{"a":{"b":2}}\nHope that helps!')).toEqual({
      a: { b: 2 },
    });
  });

  it("throws when there is no JSON at all", () => {
    expect(() => parseModelJson("just prose, no json")).toThrow(/No JSON/);
  });
});
