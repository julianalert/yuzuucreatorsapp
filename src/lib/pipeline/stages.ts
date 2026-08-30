/**
 * Pipeline stages. The audience/topic prompts were tuned against real harness
 * runs — do not "improve" their wording in passing.
 *
 * Downstream of the topic choice, the pipeline builds the per-product
 * machinery for fully personalized generation: an output template (section
 * structure + content shapes), a quiz that elicits personalization signal,
 * and a product-specific generation prompt. There are no segments and no
 * archetypes anywhere — every buyer's document is written from their own
 * answers at runtime.
 */

import { ask, type AskOptions } from "./ask";
import type {
  AudienceCard,
  CreatorInput,
  GeneratedOutput,
  KnowledgePack,
  OutputTemplate,
  Quiz,
  QuizAnswers,
  SampleBuyer,
  Safety,
  SectionComponent,
  TopicProposal,
  TopicProposals,
  Voice,
} from "../blueprint/types";
import { validateGeneratedOutput } from "../blueprint/validate";
import { TOPIC_COUNT } from "./constants";

type Ctx = Pick<AskOptions, "usage"> & {
  /** On rebuilds: the creator's reason for rejecting the previous version. */
  feedback?: string;
};

/** Injected into every product-shaping prompt on a rebuild. */
function feedbackBlock(ctx: Ctx): string {
  if (!ctx.feedback) return "";
  return `

IMPORTANT — a previous version of this product was built and the creator rejected it. Their feedback:
<creator_feedback>${ctx.feedback}</creator_feedback>
Treat this as a hard requirement: work out what in the previous approach prompted it and make this version address it directly. Do not repeat the rejected approach.`;
}

export async function extractAudience(creator: CreatorInput, ctx: Ctx = {}): Promise<AudienceCard> {
  return ask(
    "extract",
    `You are analyzing a creator's public content to build an audience profile that will drive a paid digital product.

<creator_input>
handle: ${creator.handle}
bio: ${creator.bio}
captions:
${creator.captions.map((c) => "- " + c).join("\n")}
comments:
${creator.comments.map((c) => "- " + c).join("\n")}
self_description: ${creator.self_description}
</creator_input>

Extract only what the evidence supports. Where evidence is thin, say so in confidence rather than inventing a plausible profile.

Pay particular attention to the comments. The words the audience uses for their own problem matter more than the words the creator uses. When they differ, record both.

Sparse comments are normal for smaller accounts and are NOT by themselves a reason for low confidence in "who" or "core_promise": a clear bio and consistent captions are strong evidence for both. Reserve low scores on those two axes for genuinely unreadable positioning. Score "objections" honestly from whatever audience language exists — a low objections score is fine and expected when comments are few.

Return JSON only:
{"who":"...","core_promise":"...","vocabulary":[...],"audience_words":[...],"objections":[...],"tone_notes":"...","credibility_basis":"...","confidence":{"who":0-1,"core_promise":0-1,"objections":0-1},"evidence":{"who":["..."],"core_promise":["..."]}}`,
    ctx
  );
}

export async function proposeTopics(
  audienceCard: AudienceCard,
  ctx: Ctx = {}
): Promise<TopicProposals> {
  return ask(
    "build",
    `You are proposing digital product topics for this creator.

<audience_card>${JSON.stringify(audienceCard, null, 2)}</audience_card>

The product SHAPE is fixed: a quiz captures the buyer's exact situation, then a personalized, time-boxed transformation plan is written for them individually, priced $20-50.

The TIME HORIZON is yours to choose per topic: 14, 21, 30, 45, 60, or 90 days. Pick the shortest horizon that credibly delivers the promise — a habit reset might be 14 days, a physiological change 60. Do not default every topic to the same length; let each problem dictate its own duration, and don't force a problem into a horizon that's too short to be honest or too long to stay urgent.

Generate 8 candidates internally. Score each 1-10 on:
- acuteness: felt weekly or daily right now? Merely interesting scores 3 or below.
- segmentability: would two buyers with different situations need genuinely different plans? If one plan serves everyone, personalization is theater — score 3 or below.
- resolvability: real change within your chosen duration, no purchases, under 20 min/day?
- credibility: is this creator obviously the right person, given credibility_basis?

Reject any candidate below 6 on segmentability or below 5 on acuteness regardless of total.

Return JSON only:
{"proposals":[{"topic_title":"...","promise":"...","duration_days":n,"scores":{"acuteness":n,"segmentability":n,"resolvability":n,"credibility":n},"why_this_works":"...","segmentation_preview":["4-6 buyer situations needing different plans"],"risk":"..."}]}

Return the top ${TOPIC_COUNT}. If fewer than ${TOPIC_COUNT} survive the rejection rules, return fewer and add {"insufficient": true}.${feedbackBlock(ctx)}`,
    ctx
  );
}

/**
 * One wild-card idea, generated after the safe transformation proposals.
 * Same delivery machine (quiz → personalized written document), different shape.
 */
export async function proposeBonusTopic(
  audienceCard: AudienceCard,
  existing: TopicProposal[],
  ctx: Ctx = {}
): Promise<TopicProposal> {
  return ask(
    "build",
    `You already proposed these safe product ideas for this creator:

<already_proposed>${JSON.stringify(
      existing.map((p) => ({ topic_title: p.topic_title, promise: p.promise })),
      null,
      2
    )}</already_proposed>

<audience_card>${JSON.stringify(audienceCard, null, 2)}</audience_card>

Now propose ONE bonus idea — the original one. The idea this creator would never think to make, but their audience would instantly want.

Break the formula: it must NOT be another "fix problem X in N days" transformation plan, and it must not be a close cousin of anything in already_proposed. Think sideways: a personalized playbook, a decision system, an audit, a field guide, a ritual, a "which one are you" deep-dive, a contrarian take that reframes the problem, an angle from an adjacent domain the audience doesn't expect.

Hard constraints (the delivery machine is fixed):
- A short quiz must be able to genuinely personalize it — different buyers get materially different content. If everyone would get the same document, the idea is wrong.
- Deliverable as a written, sectioned document. No video, community, coaching, templates-only or software.
- Same audience, and this creator must be credible for it given credibility_basis.
- Priced $20-50 and honest at that price.
- Surprising is good; gimmicky is not. It must solve or illuminate something the audience actually feels.

Score it 1-10 on the same dimensions (resolvability = "the product can honestly deliver its promise"). If the idea has a natural time component, include duration_days (14-90); if it isn't time-boxed, omit duration_days entirely.

Return JSON only:
{"topic_title":"...","promise":"...","duration_days":n (optional),"scores":{"acuteness":n,"segmentability":n,"resolvability":n,"credibility":n},"why_this_works":"one sentence on why this is the unexpected-but-right idea","segmentation_preview":["4-6 buyer situations needing different content"],"risk":"..."}${feedbackBlock(ctx)}`,
    ctx
  );
}

export async function buildKnowledgePack(
  topic: TopicProposal,
  audienceCard: AudienceCard,
  ctx: Ctx = {}
): Promise<KnowledgePack> {
  return ask(
    "build",
    `Build the domain knowledge base for this product. Everything downstream cites from this and nothing else.

<topic>${JSON.stringify(topic)}</topic>
<audience_card>${JSON.stringify(audienceCard)}</audience_card>

ROOT_CAUSES — 6 to 10 distinct root causes of the problem, each with a plain-language explanation. These are context for a writer diagnosing one specific buyer, not categories to sort buyers into. Split by cause, not symptom severity or demographics.
MECHANISMS — 6 to 12 interventions, each with a why_it_works explaining the causal chain in plain language. "It works because it builds consistency" is not a mechanism. If you cannot state the mechanism, drop the intervention.
FALSE_BELIEFS — 4 to 6 wrong beliefs with defensible corrections, drawn from the objections where possible.
GLOSSARY — terms the plan will use, one line each.

Rules: no intervention requiring a purchase; flag contested items with "contested":true and state both sides; mark uncertain claims "confidence":"low" rather than omitting them.

Return JSON only:
{"root_causes":[{"id":"rc_...","label":"...","prevalence":"high|medium|low","explanation":"..."}],"mechanisms":[{"id":"mech_...","name":"...","why_it_works":"..."}],"false_beliefs":[{"belief":"...","correction":"..."}],"glossary":{"term":"definition"}}${feedbackBlock(ctx)}`,
    // the pack routinely runs past the 8k default and a truncated response
    // fails JSON parsing (seen in prod at ~21k chars)
    { maxTokens: 16000, ...ctx }
  );
}

// ─────────────────────────────────────────────── component shape contracts

/** JSON contract per section component — the writer's structural spec. */
const COMPONENT_SHAPES: Record<SectionComponent, string> = {
  prose: `"intro":["3-6 body paragraphs carrying the whole section"]`,
  cards: `"cards":[{"kicker":"short uppercase kicker e.g. MECHANISM 01","title":"...","body":"2-3 sentences","tag":"short label"}] — 3 to 6 cards`,
  timeline: `"timeline":[{"marker":"1","range":"e.g. Weeks 1-2 · Environment","title":"...","body":"3-5 sentences of concrete steps"}] — 3 to 5 steps in order`,
  table: `"table":{"rows":[{"cells":["one value per declared column, same order"],"badge":"high|medium|low (optional, renders on the last cell)"}]} — 4 to 8 rows`,
  rhythm: `"rhythm":[{"time":"e.g. 06:30","title":"...","desc":"1-2 sentences"}] — 6 to 10 time slots in chronological order`,
  checklist: `"checklist":[{"label":"group name","items":["concrete, checkable items"]}] — 2 to 5 groups`,
  brief: `"brief":{"title":"...","groups":[{"label":"...","items":["..."]}]} — 3 to 5 groups`,
};

function sectionContract(s: {
  id: string;
  title: string;
  component: SectionComponent;
  table_columns?: string[];
  instructions: string;
}): string {
  const cols =
    s.component === "table" && s.table_columns?.length
      ? ` Columns, in order: ${s.table_columns.join(" | ")}.`
      : "";
  return `"${s.id}" — ${s.title} [${s.component}]
  Purpose: ${s.instructions}${cols}
  Shape: {"callout":{"label":"short uppercase label","body":"2-4 sentences addressed to THIS buyer's stated situation"},"intro":["0-3 body paragraphs"],${COMPONENT_SHAPES[s.component]},"outro":"optional closing paragraph"}`;
}

// ──────────────────────────────────────────────────── build-time stages

export async function designOutputTemplate(
  topic: TopicProposal,
  knowledgePack: KnowledgePack,
  audienceCard: AudienceCard,
  ctx: Ctx = {}
): Promise<OutputTemplate> {
  return ask(
    "build",
    `Design the output document template for this product. The template is fixed per product; a writer later fills it for each individual buyer from their quiz answers.

<topic>${JSON.stringify(topic)}</topic>
<knowledge_pack>${JSON.stringify(knowledgePack)}</knowledge_pack>
<audience_card>${JSON.stringify(audienceCard)}</audience_card>

Design 5-8 sections that together deliver the promise. Each section declares ONE dominant component:
- "prose" — flowing explanation (use sparingly, max 1)
- "cards" — a grid of mechanism/priority/mistake cards
- "timeline" — phased steps over the plan duration
- "table" — a prioritized reference table (declare 2-6 column headers)
- "rhythm" — a time-stamped daily schedule
- "checklist" — measurable milestone checklists
- "brief" — a structured summary the buyer hands to someone else (doctor, trainer, partner) — include only when the domain genuinely benefits

A strong document typically opens with a diagnosis-style section (cards explaining what is going on for this buyer and why), moves through the plan (timeline), and ends with something the buyer keeps using (rhythm, checklist or brief).

For each section write "instructions": 2-4 sentences on what it must accomplish FOR ONE SPECIFIC BUYER and which quiz-provided facts it must visibly use. Generic instructions produce generic documents — name the personalization.

Also design the cover:
- doc_label: a short product wordmark (2-3 words max, title case, no "AI")
- cover_label: one line, e.g. "Personalized <domain> Plan"
- fingerprint_title: what the cover bar-chart measures, in the audience's words
- fingerprint_axes: 5-8 short axis labels the quiz can genuinely measure per buyer (aspects of their situation, severity, constraints)

Return JSON only:
{"doc_label":"...","cover_label":"...","fingerprint_title":"...","fingerprint_axes":["..."],"sections":[{"id":"snake_case_id","eyebrow":"e.g. Part 01 · Nutrition","title":"...","description":"one line under the title","accent":"zest|sage|amber|rose","component":"prose|cards|timeline|table|rhythm|checklist|brief","table_columns":["only when component is table"],"instructions":"..."}]}${feedbackBlock(ctx)}`,
    ctx
  );
}

export async function designQuiz(
  topic: TopicProposal,
  knowledgePack: KnowledgePack,
  audienceCard: AudienceCard,
  template: OutputTemplate,
  ctx: Ctx = {}
): Promise<Quiz> {
  return ask(
    "build",
    `Design the intake quiz for this product. Its only job is to gather the material a writer needs to produce a genuinely personalized document for one buyer — their situation, severity, constraints, history, and context.

<topic>${JSON.stringify(topic)}</topic>
<knowledge_pack>${JSON.stringify(knowledgePack)}</knowledge_pack>
<audience_card>${JSON.stringify(audienceCard)}</audience_card>
<template_sections>${JSON.stringify(
      template.sections.map((s) => ({ id: s.id, title: s.title, instructions: s.instructions }))
    )}</template_sections>
<fingerprint_axes>${JSON.stringify(template.fingerprint_axes)}</fingerprint_axes>

Write 6-12 questions. Constraints, enforced by a validator after you:
- Every question declares "informs": the template section ids its answer materially changes. A question that changes nothing must be deleted — no exceptions for rapport or intro personalization.
- Every fingerprint axis must be measurable from at least one question.
- Use the audience's own words from audience_words, not clinical terms.
- Ask what the buyer observes, not what they diagnose. "How often does X happen" beats "do you have condition Y".
- Answer options must cover the realistic range, including an honest "none of these" where relevant.
- One safety question if the domain has any escalation path.
- Easy to hard. First question answerable in under two seconds.
- Prefer "single" type; use "multi" only where combinations genuinely matter.

Return JSON only:
{"questions":[{"id":"q_...","question":"...","type":"single|multi","required":true,"help":"optional clarifier","informs":["section ids"],"options":[{"value":"snake_case","label":"buyer-facing label","sub":"optional detail"}]}]}${feedbackBlock(ctx)}`,
    ctx
  );
}

export async function writeGenerationPrompt(
  topic: TopicProposal,
  knowledgePack: KnowledgePack,
  template: OutputTemplate,
  voice: Voice,
  safety: Safety,
  ctx: Ctx = {}
): Promise<string> {
  const res = await ask(
    "build",
    `Write the CRITICAL RULES block for a generation prompt. At runtime, a writer model receives one buyer's full quiz answers plus this rules block, and must produce a personalized document. These rules are what separates a hand-crafted-feeling document from a generic one.

<topic>${JSON.stringify(topic)}</topic>
<knowledge_pack>${JSON.stringify(knowledgePack)}</knowledge_pack>
<sections>${JSON.stringify(template.sections.map((s) => ({ id: s.id, title: s.title })))}</sections>
<voice>${JSON.stringify(voice)}</voice>
<safety>${JSON.stringify(safety)}</safety>

Write 8-12 numbered rules covering:
1. The specificity rule — every section must visibly use the buyer's stated facts. Include one BAD/GOOD example pair using realistic quiz answers from this domain, so the writer cannot misinterpret it.
2. How the diagnosis must be derived: pick the root causes from the knowledge pack that this buyer's answers actually point to, and say why in their words. Never present all root causes.
3. Mechanism honesty: every recommendation cites a mechanism from the knowledge pack; if no mechanism fits, cut the recommendation.
4. Constraint fidelity: whatever time/budget/context limits the buyer stated are hard limits. Include a concrete example (e.g. if they said 10 minutes a day, no step may need more).
5. Calibration: severity assessments must vary with the answers — a writer that always lands on "moderate" is broken.
6. Domain-specific failure modes to avoid (draw from false_beliefs).
7. Safety behavior for this domain — when to insert a "see a professional" note.
8. Voice: reading level, person, banned phrases, and 2-3 domain-specific tone notes.

End with a QUALITY CHECKLIST of 5-7 yes/no self-verification questions the writer must pass before returning.

Return JSON only: {"rules":"the full rules block as plain text with numbered rules and the checklist"}${feedbackBlock(ctx)}`,
    { maxTokens: 4000, ...ctx }
  );
  return typeof res === "string" ? res : (res.rules as string);
}

export async function inventSampleBuyers(
  quiz: Quiz,
  audienceCard: AudienceCard,
  ctx: Ctx = {}
): Promise<SampleBuyer[]> {
  const res = await ask(
    "build",
    `Invent 3 realistic, deliberately different buyers of this product and answer the quiz as each of them. These synthetic buyers drive the sample documents the creator reviews before launch — if the three feel interchangeable, the review proves nothing.

<audience_card>${JSON.stringify(audienceCard)}</audience_card>
<quiz>${JSON.stringify(quiz.questions)}</quiz>

Make the three differ on the dimensions that most change the plan: severity, constraints (time, context), and history. Answer every question with valid option "value"s — arrays for "multi" questions, a single value for "single" questions.

Return JSON only:
{"buyers":[{"label":"6-10 word human label, e.g. 'Exhausted first-time owner, 10 min/day'","summary":"one sentence on who they are","answers":{"q_id":"value or [values]"}}]}`,
    { maxTokens: 3000, ...ctx }
  );
  return (res.buyers ?? res) as SampleBuyer[];
}

// ─────────────────────────────────────────────── runtime generation

/** Turn raw quiz answers into readable "question → chosen labels" pairs. */
export function readableAnswers(quiz: Quiz, answers: QuizAnswers): Record<string, string> {
  const out: Record<string, string> = {};
  for (const q of quiz.questions) {
    const given = answers[q.id];
    const values = Array.isArray(given) ? given : given ? [given] : [];
    const labels = values
      .map((v) => q.options.find((o) => o.value === v)?.label)
      .filter(Boolean);
    if (labels.length) out[q.question] = labels.join("; ");
  }
  return out;
}

export interface GenerateOutputArgs {
  template: OutputTemplate;
  generationPrompt: string;
  knowledgePack: KnowledgePack;
  voice: Voice;
  safety: Safety;
  product: { topic_title: string; promise: string; duration_days?: number };
  creatorName: string;
  /** Readable question → answer labels (from readableAnswers). */
  answers: Record<string, string>;
}

/**
 * Deterministic prompt assembly. The product's generation_prompt carries the
 * tuned rules; this wraps it with the buyer, the knowledge, and the output
 * contract derived from the template — so the schema can never drift from
 * what the renderer expects.
 */
export function composeGenerationPrompt(args: GenerateOutputArgs): string {
  const { template, generationPrompt, knowledgePack, voice, safety, product, creatorName } = args;
  const answersBlock = Object.entries(args.answers)
    .map(([q, a]) => `- ${q}\n  → ${a}`)
    .join("\n");

  return `You are writing ONE buyer's personalized document: "${product.topic_title}" by ${creatorName}.
Promise: ${product.promise}${product.duration_days ? `\nPlan duration: ${product.duration_days} days.` : ""}

This document was paid for by a real person who answered an intake quiz about their exact situation. Everything below must be written for them — not for an average buyer, not for a category.

<buyer_answers>
${answersBlock}
</buyer_answers>

<knowledge_pack>${JSON.stringify(knowledgePack)}</knowledge_pack>
<voice>${JSON.stringify(voice)}</voice>
<safety>${JSON.stringify(safety)}</safety>

CRITICAL RULES:
${generationPrompt}

OUTPUT CONTRACT — return JSON only, with exactly this structure:
{
  "cover": {
    "title": "document title",
    "subtitle": "who this was prepared for, from their answers — never invent a name",
    "fingerprint": [one number 0-10 per axis, in this order: ${template.fingerprint_axes.join(", ")}],
    "meta": [up to 4 of {"value":"short stat","label":"what it is"}]
  },
  "sections": {
${template.sections.map((s) => "    " + sectionContract(s).split("\n").join("\n    ")).join(",\n")}
  }
}

Every section listed in the contract must be present. Respect each section's declared shape and minimum item counts. Write in the declared voice. Never use an em dash (—) anywhere in the text; rewrite the sentence with a comma, colon, or period instead. No markdown, no preamble — JSON only.`;
}

/**
 * The prompt bans em dashes in buyer-facing text, but models still slip them
 * in — scrub deterministically so one can never reach a paid document.
 * Clause-joining em dashes read naturally as commas.
 */
export function stripEmDashes<T>(value: T): T {
  if (typeof value === "string") {
    return value
      .replace(/\s*—\s*/g, ", ")
      .replace(/^,\s*/, "")
      .replace(/,\s*([.,;:!?])/g, "$1") as unknown as T;
  }
  if (Array.isArray(value)) return value.map(stripEmDashes) as unknown as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, stripEmDashes(v)])
    ) as T;
  }
  return value;
}

export async function generateOutput(
  args: GenerateOutputArgs,
  ctx: Ctx = {}
): Promise<GeneratedOutput> {
  const prompt = composeGenerationPrompt(args);
  let lastErrors = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const retryNote = lastErrors
      ? `\n\nYour previous attempt failed structural validation:\n${lastErrors}\nFix every listed issue and return the full corrected JSON.`
      : "";
    const output = stripEmDashes(
      (await ask("writer", prompt + retryNote, {
        maxTokens: 16000,
        ...ctx,
      })) as GeneratedOutput
    );
    const check = validateGeneratedOutput(args.template, output);
    if (check.ok) return output;
    lastErrors = check.errors.map((e) => `- ${e.path}: ${e.issue}`).join("\n");
    if (attempt === 1) {
      throw new Error(`Generated output failed structural validation twice:\n${lastErrors}`);
    }
  }
  throw new Error("unreachable");
}
