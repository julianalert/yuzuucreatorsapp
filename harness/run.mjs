#!/usr/bin/env node
/**
 * Offline quality harness.
 *
 * Runs the full build chain against synthetic creators in different niches and
 * reports whether output quality survives automation. No product code, no auth,
 * no Stripe. This is the experiment that decides whether to build the SaaS.
 *
 *   node run.mjs                       all creators
 *   node run.mjs --only sleep_toddler,houseplants
 *   node run.mjs --mock                plumbing test, no API calls
 *   node run.mjs --concurrency 3
 *
 * Requires ANTHROPIC_API_KEY unless --mock.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateBlueprint, resolveArchetype } from "../validate-blueprint.js";
import * as P from "./pipeline.mjs";
import * as MOCK from "./mock.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : argv[i + 1];
};
const MOCK_MODE = argv.includes("--mock");
// The mock keeps per-creator state in module scope, so it must run serially.
// Real runs are safe to parallelize.
const CONCURRENCY = MOCK_MODE ? 1 : Number(flag("concurrency", 2));
const ONLY = flag("only", "")?.split(",").filter(Boolean) ?? [];
const INPUT = flag("input", "creators.json");

const api = MOCK_MODE ? MOCK : P;

const SKELETON = [
  { id: "diagnosis", title: "What's actually going on", target_words: 350 },
  { id: "mechanism", title: "Why what you've tried hasn't stuck", target_words: 300 },
  { id: "week_1", title: "Week 1", target_words: 700 },
  { id: "week_2", title: "Week 2", target_words: 700 },
  { id: "week_3", title: "Week 3", target_words: 700 },
  { id: "week_4", title: "Week 4", target_words: 700 },
  { id: "troubleshooting", title: "When it goes sideways", target_words: 500 },
  { id: "regression", title: "If you lose ground", target_words: 250 },
];

const RUBRIC = [
  { id: "specificity", weight: 0.3, fail_below: 7 },
  { id: "actionability", weight: 0.25, fail_below: 7 },
  { id: "mechanism", weight: 0.2, fail_below: 6 },
  { id: "voice_match", weight: 0.15, fail_below: 6 },
  { id: "claims_safety", weight: 0.1, fail_below: 9 },
];

const MIN_SCORE = 7.5;
const MIN_DIVERGENCE = 40;
/** Sections rendered for evaluation. Rendering all 8 × N archetypes is wasteful at this stage. */
const EVAL_SECTIONS = ["diagnosis", "week_1", "troubleshooting"];

const log = (id, msg) => console.log(`  [${id}] ${msg}`);

async function runCreator(creator, outDir) {
  const t0 = Date.now();
  const record = { id: creator.id, handle: creator.handle, niche_note: creator.niche_note, stages: {} };
  const dir = path.join(outDir, creator.id);
  fs.mkdirSync(path.join(dir, "samples"), { recursive: true });

  try {
    // 1 — audience
    log(creator.id, "extracting audience");
    const audience = await api.extractAudience(creator);
    const minConf = Math.min(...Object.values(audience.confidence ?? { x: 1 }));
    record.stages.audience = { min_confidence: minConf };
    if (minConf < 0.5) {
      record.halted_at = "audience_confidence";
      record.note = "Would ask the creator clarifying questions before proceeding.";
      return record;
    }

    // 2 — topics
    log(creator.id, "proposing topics");
    const topics = await api.proposeTopics(audience);
    const proposals = topics.proposals ?? [];
    record.stages.topics = {
      count: proposals.length,
      insufficient: !!topics.insufficient,
      best_segmentability: Math.max(0, ...proposals.map((p) => p.scores?.segmentability ?? 0)),
      titles: proposals.map((p) => p.topic_title),
    };
    if (!proposals.length) {
      record.halted_at = "no_viable_topic";
      record.note = "Pipeline correctly refused this niche.";
      return record;
    }
    // pick the highest total, as a creator plausibly would
    const chosen = proposals
      .map((p) => ({ p, total: Object.values(p.scores ?? {}).reduce((a, b) => a + b, 0) }))
      .sort((a, b) => b.total - a.total)[0].p;
    record.stages.topics.chosen = chosen.topic_title;

    // 3 — knowledge pack
    log(creator.id, "building knowledge pack");
    const pack = await api.buildKnowledgePack(chosen, audience);
    const kCritic = await api.knowledgeCritic(pack);
    record.stages.knowledge = {
      segments: pack.segments?.length ?? 0,
      mechanisms: pack.mechanisms?.length ?? 0,
      critic_score: kCritic.score,
      critic_pass: kCritic.pass,
      failures: kCritic.failures?.length ?? 0,
    };

    // 4 — quiz
    log(creator.id, "designing quiz");
    const quiz = await api.designQuiz(pack, audience, SKELETON);
    const voice = {
      reading_level: "grade 8",
      person: "second",
      banned_phrases: ["unlock", "game-changer", "In today's world", "journey", "dive in"],
      tone_notes: audience.tone_notes,
    };

    let bp = {
      blueprint_id: `bp_${creator.id}_v1`,
      blueprint_version: 1,
      status: "draft",
      creator: { handle: creator.handle, audience_card: audience },
      product: { topic_title: chosen.topic_title, promise: chosen.promise, duration_days: 30, price_usd: 27 },
      knowledge_pack: pack,
      quiz,
      output: { skeleton: SKELETON, content_bank: {}, voice, personalization_tokens: [] },
      safety: { domain_risk_tier: "low", disclaimers: [], banned_claims: [], escalation_triggers: [] },
      eval: { rubric: RUBRIC, swap_test: { min_divergence_pct: MIN_DIVERGENCE }, thresholds: { min_weighted_score: MIN_SCORE } },
    };

    const structural = validateBlueprint(bp);
    record.stages.quiz = {
      questions: quiz.questions?.length ?? 0,
      archetypes: quiz.archetype_rules?.length ?? 0,
      structural_errors: structural.errors.length,
      structural_sample: structural.errors.slice(0, 3).map((e) => `${e.path}: ${e.issue}`),
    };
    if (structural.errors.length) {
      record.halted_at = "structural_validation";
      fs.writeFileSync(path.join(dir, "blueprint.json"), JSON.stringify(bp, null, 2));
      return record;
    }

    const qCritic = await api.quizCritic(quiz, pack, audience.audience_words ?? []);
    record.stages.quiz.critic_score = qCritic.score;
    record.stages.quiz.critic_pass = qCritic.pass;

    // 5 — content bank, only for the archetypes we will evaluate
    const archetypes = (quiz.archetype_rules ?? []).slice(0, 4).map((r) => r.id);
    log(creator.id, `writing briefs for ${archetypes.length} archetypes`);
    for (const a of archetypes) {
      const rationale = quiz.archetype_rules.find((r) => r.id === a)?.archetype_rationale ?? "";
      const earlier = {};
      for (const s of SKELETON.filter((s) => EVAL_SECTIONS.includes(s.id))) {
        const entry = await api.writeBrief({
          knowledgePack: pack, archetype: a, rationale, section: s, voice, earlier,
        });
        bp.output.content_bank[`${s.id}::${a}`] = entry;
        earlier[s.id] = entry.brief;
      }
    }

    // 6 — render
    log(creator.id, "rendering samples");
    const renders = {};
    for (const a of archetypes) {
      renders[a] = {};
      let prev = "";
      for (const s of SKELETON.filter((s) => EVAL_SECTIONS.includes(s.id))) {
        const entry = bp.output.content_bank[`${s.id}::${a}`];
        const mechanisms = (pack.mechanisms ?? []).filter((m) => entry.mechanism_refs?.includes(m.id));
        const prose = await api.renderSection({
          entry, mechanisms, buyer: { situation: a }, voice, section: s, previousEnding: prev.slice(-200),
        });
        renders[a][s.id] = prose;
        prev = prose;
        fs.writeFileSync(path.join(dir, "samples", `${a}__${s.id}.md`), prose);
      }
    }

    // 7 — swap test first, it is free
    const pairs = [];
    for (let i = 0; i + 1 < archetypes.length; i += 2) pairs.push([archetypes[i], archetypes[i + 1]]);
    const swap = P.swapTest(renders, pairs, MIN_DIVERGENCE);
    record.stages.swap = { pass: swap.pass, divergence_pct: swap.overall };
    if (!swap.pass) {
      record.halted_at = "swap_test";
      record.note = "Archetypes are not materially different — regenerate stage 4, not stage 5.";
      fs.writeFileSync(path.join(dir, "blueprint.json"), JSON.stringify(bp, null, 2));
      return record;
    }

    // 8 — output critic
    log(creator.id, "scoring output");
    const scored = [];
    for (const a of archetypes) {
      for (const s of EVAL_SECTIONS) {
        const r = await api.outputCritic(a, renders[a][s], RUBRIC);
        scored.push({ archetype: a, section: s, weighted: r.weighted, scores: r.scores });
      }
    }
    const weighted = scored.reduce((t, s) => t + (s.weighted ?? 0), 0) / (scored.length || 1);
    const byDimension = {};
    for (const d of RUBRIC) {
      const vals = scored.map((s) => s.scores?.[d.id]?.score).filter((v) => typeof v === "number");
      byDimension[d.id] = vals.length ? +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : null;
    }
    record.stages.output = { weighted: +weighted.toFixed(2), by_dimension: byDimension, sections_scored: scored.length };
    record.passed = weighted >= MIN_SCORE;

    bp.status = record.passed ? "complete" : "draft";
    fs.writeFileSync(path.join(dir, "blueprint.json"), JSON.stringify(bp, null, 2));
    return record;
  } catch (e) {
    record.error = e.message;
    record.halted_at = record.halted_at ?? "exception";
    return record;
  } finally {
    record.seconds = Math.round((Date.now() - (t0 || Date.now())) / 1000);
  }
}

async function pool(items, n, fn) {
  const out = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) out.push(await fn(items[i++]));
    })
  );
  return out;
}

function toCsv(records) {
  const head = [
    "creator", "niche_note", "halted_at", "passed", "topics_returned", "best_segmentability",
    "chosen_topic", "questions", "archetypes", "structural_errors", "knowledge_score",
    "quiz_score", "swap_divergence", "weighted_score",
    ...RUBRIC.map((r) => `dim_${r.id}`), "seconds", "error",
  ];
  const rows = records.map((r) => [
    r.id, r.niche_note, r.halted_at ?? "", r.passed ?? "",
    r.stages.topics?.count ?? "", r.stages.topics?.best_segmentability ?? "",
    r.stages.topics?.chosen ?? "", r.stages.quiz?.questions ?? "", r.stages.quiz?.archetypes ?? "",
    r.stages.quiz?.structural_errors ?? "", r.stages.knowledge?.critic_score ?? "",
    r.stages.quiz?.critic_score ?? "", r.stages.swap?.divergence_pct ?? "",
    r.stages.output?.weighted ?? "",
    ...RUBRIC.map((d) => r.stages.output?.by_dimension?.[d.id] ?? ""),
    r.seconds ?? "", r.error ?? "",
  ]);
  return [head, ...rows]
    .map((row) => row.map((c) => (/[",\n]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : c)).join(","))
    .join("\n");
}

// ------------------------------------------------------------------- main

const inputPath = path.isAbsolute(INPUT) ? INPUT : path.join(HERE, INPUT);
if (!fs.existsSync(inputPath)) {
  console.error(`\nNo such input file: ${inputPath}`);
  console.error(`Run \`node ingest.mjs\` first, or use --input creators.json for the synthetic set.\n`);
  process.exit(1);
}
const creators = JSON.parse(fs.readFileSync(inputPath, "utf8"))
  .filter((c) => !ONLY.length || ONLY.includes(c.id));

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const outDir = path.join(HERE, "runs", stamp);
fs.mkdirSync(outDir, { recursive: true });

console.log(`\nRunning ${creators.length} creators${MOCK_MODE ? " (MOCK)" : ""} → ${outDir}\n`);

const records = await pool(creators, CONCURRENCY, (c) => runCreator(c, outDir));
records.sort((a, b) => creators.findIndex((c) => c.id === a.id) - creators.findIndex((c) => c.id === b.id));

fs.writeFileSync(path.join(outDir, "scores.csv"), toCsv(records));
fs.writeFileSync(path.join(outDir, "records.json"), JSON.stringify(records, null, 2));

const passed = records.filter((r) => r.passed).length;
const halted = records.filter((r) => r.halted_at);

console.log(`\n${"=".repeat(64)}`);
console.log(`Passed:  ${passed}/${records.length}`);
console.log(`Halted:  ${halted.length}`);
for (const r of records) {
  const verdict = r.passed ? "PASS" : r.halted_at ? `HALT @ ${r.halted_at}` : "FAIL";
  const score = r.stages.output?.weighted ? ` ${r.stages.output.weighted}` : "";
  console.log(`  ${r.id.padEnd(20)} ${verdict}${score}`);
}
if (!MOCK_MODE) {
  const u = P.getUsage();
  console.log(`\nAPI calls: ${u.calls}  |  est. cost: $${P.estimateCost().toFixed(2)}`);
}
console.log(`\nscores.csv → ${path.join(outDir, "scores.csv")}\n`);

console.log("What to read first:");
console.log("  1. Any creator that halted at swap_test — archetypes were fake, quiz design failed.");
console.log("  2. dim_specificity across niches — the dimension that degrades first under automation.");
console.log("  3. Whether sourdough produced a topic at all. If it did, segmentability scoring is too generous.\n");
