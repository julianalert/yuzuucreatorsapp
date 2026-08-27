/**
 * Critics. Knowledge and claims critics are ported from harness/pipeline.mjs;
 * the quiz and output critics are retargeted at the per-buyer generation
 * contract (no archetypes — the quiz gathers personalization signal, the
 * output critic scores one whole generated document).
 */

import { ask, type AskOptions } from "./ask";
import type {
  CriticResult,
  KnowledgePack,
  OutputCriticResult,
  OutputTemplate,
  Quiz,
  RubricDimension,
} from "../blueprint/types";

type Ctx = Pick<AskOptions, "usage">;

const criticSchema = `Return JSON only: {"pass":true|false,"score":1-10,"failures":[{"path":"...","issue":"...","fix":"..."}]}`;

export async function knowledgeCritic(pack: KnowledgePack, ctx: Ctx = {}): Promise<CriticResult> {
  return ask(
    "critic",
    `Audit this knowledge pack for a paid product.

<knowledge_pack>${JSON.stringify(pack)}</knowledge_pack>

1. Every mechanism has a real causal explanation, not a restatement of the outcome.
2. No factual claim that is wrong or materially outdated. Flag specifics.
3. Root causes split by cause, not severity. Two root causes that would lead to the same advice are one root cause.
4. Corrections are defensible, not merely contrarian.
5. Nothing requires a purchase.

Be adversarial. A pack that passes with no findings is more likely under-reviewed than perfect.

${criticSchema}`,
    ctx
  );
}

export async function quizCritic(
  quiz: Quiz,
  template: OutputTemplate,
  pack: KnowledgePack,
  audienceWords: string[],
  ctx: Ctx = {}
): Promise<CriticResult> {
  return ask(
    "critic",
    `Audit this intake quiz. Its job is to gather everything a writer needs to produce a genuinely personalized document for one buyer.

<quiz>${JSON.stringify(quiz)}</quiz>
<template_sections>${JSON.stringify(
      template.sections.map((s) => ({ id: s.id, title: s.title, instructions: s.instructions }))
    )}</template_sections>
<fingerprint_axes>${JSON.stringify(template.fingerprint_axes)}</fingerprint_axes>
<knowledge_pack>${JSON.stringify(pack)}</knowledge_pack>
<audience_words>${JSON.stringify(audienceWords)}</audience_words>

For EACH question, state what it lets the writer personalize. If the answer would not change any section's content, the question fails.

Then check: would two realistic buyers with different situations give visibly different answer sets; can every fingerprint axis be scored from the answers; can a buyer answer every question about themselves without expertise; does any question ask for self-diagnosis rather than observation; does the language match audience_words; do the options cover the realistic range; is the first question answerable in under two seconds.

Give exact fixes, not general notes.

${criticSchema}`,
    ctx
  );
}

export async function outputCritic(
  buyerContext: string,
  documentText: string,
  rubric: RubricDimension[],
  ctx: Ctx = {}
): Promise<OutputCriticResult> {
  return ask(
    "critic",
    `Score this personalized document against the rubric. You are reviewing a $27 product a real person paid for.

<buyer>${buyerContext}</buyer>
<document>${documentText}</document>
<rubric>${JSON.stringify(rubric)}</rubric>

For specificity, apply the test literally: pick any paragraph. Could it be sent unchanged to a buyer in a different situation? If yes, that paragraph fails and you must quote it. The document must visibly use the buyer's stated facts.

Score each rubric dimension 1-10 with a one-line justification and at least one quoted example. Scores without quoted evidence are invalid.

Return JSON only: {"pass":true|false,"scores":{"<rubric_id>":{"score":n,"why":"...","evidence":"quoted"}},"weighted":n,"failures":[...]}`,
    { maxTokens: 4000, ...ctx }
  );
}

export async function claimsCritic(
  section: string,
  domain: string,
  bannedClaims: string[],
  ctx: Ctx = {}
): Promise<CriticResult> {
  return ask(
    "critic",
    `Review for claims risk. Domain: ${domain}.

<section>${section}</section>
<banned_claims>${JSON.stringify(bannedClaims)}</banned_claims>

Flag outcome guarantees, medical or financial advice presented as certain, anything needing professional supervision, missing disclaimers, and claims contradicting mainstream guidance without acknowledging disagreement.

Err toward flagging. A false positive costs a rewrite. A false negative costs the creator's license.

${criticSchema}`,
    ctx
  );
}
