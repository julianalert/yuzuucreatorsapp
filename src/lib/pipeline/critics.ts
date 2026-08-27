/**
 * Critics, ported verbatim from harness/pipeline.mjs.
 */

import { ask, type AskOptions } from "./ask";
import type {
  CriticResult,
  KnowledgePack,
  OutputCriticResult,
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
3. Segments split by cause, not severity. Two segments that would receive the same plan are one segment.
4. Corrections are defensible, not merely contrarian.
5. Nothing requires a purchase.

Be adversarial. A pack that passes with no findings is more likely under-reviewed than perfect.

${criticSchema}`,
    ctx
  );
}

export async function quizCritic(
  quiz: Quiz,
  pack: KnowledgePack,
  audienceWords: string[],
  ctx: Ctx = {}
): Promise<CriticResult> {
  return ask(
    "critic",
    `Audit this quiz.

<quiz>${JSON.stringify(quiz)}</quiz>
<knowledge_pack>${JSON.stringify(pack)}</knowledge_pack>
<audience_words>${JSON.stringify(audienceWords)}</audience_words>

For EACH question, state which archetypes it separates. If a question separates none, it fails.

Then check: can a buyer answer every question about themselves without expertise; does any question ask for self-diagnosis rather than observation; are archetypes genuinely distinguishable or do several collapse into one plan; does the language match audience_words; is any archetype unreachable; is the first question answerable in under two seconds.

Give exact fixes, not general notes.

${criticSchema}`,
    ctx
  );
}

export async function outputCritic(
  archetype: string,
  section: string,
  rubric: RubricDimension[],
  ctx: Ctx = {}
): Promise<OutputCriticResult> {
  return ask(
    "critic",
    `Score this plan section against the rubric. You are reviewing a $27 product a real person paid for.

<archetype>${archetype}</archetype>
<section>${section}</section>
<rubric>${JSON.stringify(rubric)}</rubric>

For specificity, apply the test literally: pick any paragraph. Could it be sent unchanged to a buyer of a different archetype? If yes, that paragraph fails and you must quote it.

Score each rubric dimension 1-10 with a one-line justification and at least one quoted example. Scores without quoted evidence are invalid.

Return JSON only: {"pass":true|false,"scores":{"<rubric_id>":{"score":n,"why":"...","evidence":"quoted"}},"weighted":n,"failures":[...]}`,
    ctx
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
