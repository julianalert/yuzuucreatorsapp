import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createMockApi } from "./mock";
import { swapTest, divergence } from "./swap";
import { parseModelJson } from "./ask";
import { readableAnswers, stripEmDashes } from "./stages";
import { RUBRIC, MIN_SCORE, MIN_DIVERGENCE, SAMPLE_BUYER_COUNT, defaultVoice } from "./constants";
import { validateBlueprint, flattenGeneratedOutput } from "../blueprint/validate";
import type { Blueprint, CreatorInput, GeneratedOutput, Safety } from "../blueprint/types";

const creators: CreatorInput[] = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../../../harness/creators.json"), "utf8")
);

const SAFETY: Safety = {
  domain_risk_tier: "low",
  disclaimers: [],
  banned_claims: [],
  escalation_triggers: [],
};

/** Mirrors the blueprintBuild gating, using the mock api. */
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

  const template = await api.designOutputTemplate(chosen, pack, audience);
  const quiz = await api.designQuiz(chosen, pack, audience, template);
  const voice = defaultVoice(audience.tone_notes);
  const generationPrompt = await api.writeGenerationPrompt(chosen, pack, template, voice, SAFETY);

  const bp: Blueprint = {
    blueprint_id: `bp_${creator.id}_v1`,
    blueprint_version: 1,
    status: "draft",
    creator: { handle: creator.handle, audience_card: audience },
    product: { topic_title: chosen.topic_title, promise: chosen.promise, duration_days: 21, price_usd: 27 },
    knowledge_pack: pack,
    quiz,
    output: { template, generation_prompt: generationPrompt, voice },
    safety: SAFETY,
    eval: {
      rubric: RUBRIC,
      swap_test: { min_divergence_pct: MIN_DIVERGENCE },
      thresholds: { min_weighted_score: MIN_SCORE },
    },
  };

  const structural = validateBlueprint(bp);
  if (structural.errors.length) return { halted_at: "structural_validation", errors: structural.errors };

  await api.quizCritic(quiz, template, pack, audience.audience_words ?? []);

  // three synthetic buyers run the real runtime path
  const buyers = (await api.inventSampleBuyers(quiz, audience)).slice(0, SAMPLE_BUYER_COUNT);
  const outputs: GeneratedOutput[] = [];
  for (const buyer of buyers) {
    outputs.push(
      await api.generateOutput({
        template,
        generationPrompt,
        knowledgePack: pack,
        voice,
        safety: SAFETY,
        product: { topic_title: chosen.topic_title, promise: chosen.promise, duration_days: 21 },
        creatorName: creator.handle,
        answers: readableAnswers(quiz, buyer.answers),
      })
    );
  }

  // swap test: pairwise divergence between persona documents
  const renders: Record<string, Record<string, string>> = {};
  buyers.forEach((_, i) => {
    renders[`p${i}`] = flattenGeneratedOutput(template, outputs[i]);
  });
  const pairs: [string, string][] = [];
  for (let i = 0; i < buyers.length; i++) {
    for (let j = i + 1; j < buyers.length; j++) pairs.push([`p${i}`, `p${j}`]);
  }
  const swap = swapTest(renders, pairs, MIN_DIVERGENCE);
  if (!swap.pass) return { halted_at: "swap_test", divergence: swap.overall };

  const scored: number[] = [];
  for (let i = 0; i < buyers.length; i++) {
    const flat = flattenGeneratedOutput(template, outputs[i]);
    const doc = Object.values(flat).join("\n\n");
    const r = await api.outputCritic(buyers[i].label, doc, RUBRIC);
    scored.push(r.weighted ?? 0);
  }
  const weighted = scored.reduce((t, s) => t + s, 0) / (scored.length || 1);
  return { passed: weighted >= MIN_SCORE, weighted: +weighted.toFixed(2) };
}

const byId = (id: string) => creators.find((c) => c.id === id)!;

describe("mock pipeline gating (mirrors blueprintBuild)", () => {
  it("sourdough is refused at topic proposal — the pipeline saying no is a feature", async () => {
    const r = await runCreator(byId("sourdough"));
    expect(r.halted_at).toBe("no_viable_topic");
  });

  it("language_spanish halts at the swap test — different buyers, same document", async () => {
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

  it("repairs trailing commas in arrays and objects", () => {
    expect(parseModelJson('{"items": ["a", "b",], "n": 1,}')).toEqual({
      items: ["a", "b"],
      n: 1,
    });
  });

  it("still throws on genuinely broken JSON (missing comma between elements)", () => {
    expect(() => parseModelJson('{"items": ["a" "b"]}')).toThrow();
  });
});

describe("stripEmDashes", () => {
  it("turns clause-joining em dashes into commas", () => {
    expect(stripEmDashes("do this — then that")).toBe("do this, then that");
    expect(stripEmDashes("tight—joined")).toBe("tight, joined");
  });

  it("drops a leading em dash and avoids double punctuation", () => {
    expect(stripEmDashes("— a fresh start")).toBe("a fresh start");
    expect(stripEmDashes("wait —, no")).toBe("wait, no");
  });

  it("recurses through objects and arrays, leaving non-strings alone", () => {
    expect(
      stripEmDashes({ cover: { title: "A — B" }, meta: [{ value: "10 — 12", n: 3 }] })
    ).toEqual({ cover: { title: "A, B" }, meta: [{ value: "10, 12", n: 3 }] });
  });

  it("never leaves an em dash anywhere", () => {
    const out = stripEmDashes({ a: "x — y", b: ["— z", { c: "p—q" }] });
    expect(JSON.stringify(out)).not.toContain("—");
  });
});
