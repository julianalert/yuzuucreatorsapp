/**
 * Pipeline stages, ported from harness/pipeline.mjs. Prompts are verbatim —
 * they were tuned against real runs. Deliberate deviations, per product spec:
 *
 *   - proposeTopics returns the top 5 (harness returned 4); the creator UI
 *     shows five ideas.
 *
 * Do not "improve" prompt wording in passing.
 */

import { ask, type AskOptions } from "./ask";
import type {
  AudienceCard,
  ContentBankEntry,
  CreatorInput,
  KnowledgePack,
  Mechanism,
  Quiz,
  SkeletonSection,
  TopicProposal,
  TopicProposals,
  Voice,
} from "../blueprint/types";
import { TOPIC_COUNT } from "./constants";

type Ctx = Pick<AskOptions, "usage">;

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

The product SHAPE is fixed: a quiz diagnoses the buyer, then they receive a personalized, time-boxed transformation plan as a PDF, priced $20-50.

The TIME HORIZON is yours to choose per topic: 14, 21, 30, 45, 60, or 90 days. Pick the shortest horizon that credibly delivers the promise — a habit reset might be 14 days, a physiological change 60. Do not default every topic to the same length; let each problem dictate its own duration, and don't force a problem into a horizon that's too short to be honest or too long to stay urgent.

Generate 8 candidates internally. Score each 1-10 on:
- acuteness: felt weekly or daily right now? Merely interesting scores 3 or below.
- segmentability: would two buyers with different situations need genuinely different plans? If one plan serves everyone, personalization is theater — score 3 or below.
- resolvability: real change within your chosen duration, no purchases, under 20 min/day?
- credibility: is this creator obviously the right person, given credibility_basis?

Reject any candidate below 6 on segmentability or below 5 on acuteness regardless of total.

Return JSON only:
{"proposals":[{"topic_title":"...","promise":"...","duration_days":n,"scores":{"acuteness":n,"segmentability":n,"resolvability":n,"credibility":n},"why_this_works":"...","segmentation_preview":["4-6 buyer situations needing different plans"],"risk":"..."}]}

Return the top ${TOPIC_COUNT}. If fewer than ${TOPIC_COUNT} survive the rejection rules, return fewer and add {"insufficient": true}.`,
    ctx
  );
}

/**
 * One wild-card idea, generated after the safe transformation proposals.
 * Same delivery machine (quiz → personalized written PDF), different shape.
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
- Deliverable as a written, sectioned PDF. No video, community, coaching, templates-only or software.
- Same audience, and this creator must be credible for it given credibility_basis.
- Priced $20-50 and honest at that price.
- Surprising is good; gimmicky is not. It must solve or illuminate something the audience actually feels.

Score it 1-10 on the same dimensions (resolvability = "the product can honestly deliver its promise"). If the idea has a natural time component, include duration_days (14-90); if it isn't time-boxed, omit duration_days entirely.

Return JSON only:
{"topic_title":"...","promise":"...","duration_days":n (optional),"scores":{"acuteness":n,"segmentability":n,"resolvability":n,"credibility":n},"why_this_works":"one sentence on why this is the unexpected-but-right idea","segmentation_preview":["4-6 buyer situations needing different content"],"risk":"..."}`,
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

SEGMENTS — 6 to 10 slices split by ROOT CAUSE, not symptom severity or demographics.
MECHANISMS — 6 to 12 interventions, each with a why_it_works explaining the causal chain in plain language. "It works because it builds consistency" is not a mechanism. If you cannot state the mechanism, drop the intervention.
FALSE_BELIEFS — 4 to 6 wrong beliefs with defensible corrections, drawn from the objections where possible.
GLOSSARY — terms the plan will use, one line each.

Rules: no intervention requiring a purchase; flag contested items with "contested":true and state both sides; mark uncertain claims "confidence":"low" rather than omitting them.

Return JSON only:
{"segments":[{"id":"seg_...","label":"...","prevalence":"high|medium|low","root_cause":"..."}],"mechanisms":[{"id":"mech_...","name":"...","why_it_works":"...","applies_to_segments":[...]}],"false_beliefs":[{"belief":"...","correction":"..."}],"glossary":{"term":"definition"}}`,
    ctx
  );
}

export async function designQuiz(
  knowledgePack: KnowledgePack,
  audienceCard: AudienceCard,
  skeleton: SkeletonSection[],
  ctx: Ctx = {}
): Promise<Quiz> {
  return ask(
    "build",
    `Design the diagnostic quiz and archetype resolution rules.

<knowledge_pack>${JSON.stringify(knowledgePack)}</knowledge_pack>
<audience_card>${JSON.stringify(audienceCard)}</audience_card>
<sections>${skeleton.map((s) => s.id).join(", ")}</sections>

Design in this order. Do not reverse it.

1. ARCHETYPES FIRST. 6-12 buyer identities from the segments. An archetype is a person in a situation, not a category label. Each must lead to a materially different plan.
2. THEN the signals needed to distinguish them.
3. THEN the questions that elicit those signals. 6-12 questions.

Constraints, enforced by a validator after you:
- Every question declares "drives" (sections it changes) and/or "modifies" (one of: constraints, voice, safety, pacing). A question that does neither must be deleted — no exceptions for rapport or intro personalization.
- Every non-conditional section must be driven by at least one question.
- Every archetype reachable by at least one valid answer combination.
- Use the audience's own words from audience_words, not clinical terms.
- Ask what the buyer observes, not what they diagnose.
- One safety question if the domain has any escalation path.
- Easy to hard. First question answerable in under two seconds.

Return JSON only:
{"questions":[{"id":"q_...","question":"...","type":"single|multi","required":true,"drives":[...],"modifies":[...],"options":[{"value":"...","label":"...","signals":{"key":"value"}}]}],"archetype_rules":[{"id":"arch_...","label":"...","priority":n,"archetype_rationale":"what makes this plan different","match":{"all":[{"signal":"...","in":[...]}]}}],"fallback_archetype":"arch_general"}`,
    ctx
  );
}

export async function writeBrief(
  args: {
    knowledgePack: KnowledgePack;
    archetype: string;
    rationale: string;
    section: SkeletonSection;
    voice: Voice;
    earlier: Record<string, string>;
  },
  ctx: Ctx = {}
): Promise<ContentBankEntry> {
  const { knowledgePack, archetype, rationale, section, voice, earlier } = args;
  return ask(
    "build",
    `Write the content brief for one section of one archetype's plan.

<knowledge_pack>${JSON.stringify(knowledgePack)}</knowledge_pack>
<archetype>${archetype} — ${rationale}</archetype>
<section>${section.id}: ${section.title}, target ${section.target_words} words</section>
<voice>${JSON.stringify(voice)}</voice>
<already_written>${JSON.stringify(earlier)}</already_written>

You are writing a BRIEF, not prose. The brief tells a writer what must be conveyed for this specific person. The writer produces the actual words later, with the buyer's real details.

Return JSON only:
{"brief":"2-4 sentences on what this section must accomplish FOR THIS ARCHETYPE. If it would read the same for a different archetype, it is wrong — rewrite it.","must_include":["3-5 points concrete enough that their absence is checkable"],"must_avoid":["2-4 items, including failure modes specific to this archetype"],"mechanism_refs":["ids from the knowledge pack"]${section.id.startsWith("week") ? ',"week_theme":"3-5 words"' : ""}}

${section.id.startsWith("week") ? "Phase sections cover the day range in the section title. They must fit the smallest stated time budget, state what changes from the previous phase and why now, and name one thing the buyer should NOT do yet." : ""}`,
    { maxTokens: 2000, ...ctx }
  );
}

export async function renderSection(
  args: {
    entry: ContentBankEntry;
    mechanisms: Mechanism[];
    buyer: Record<string, unknown>;
    voice: Voice;
    section: SkeletonSection;
    previousEnding: string;
  },
  ctx: Ctx = {}
): Promise<string> {
  const { entry, mechanisms, buyer, voice, section, previousEnding } = args;
  return ask(
    "writer",
    `Write one section of a personalized plan.

<brief>${entry.brief}</brief>
<must_include>${JSON.stringify(entry.must_include)}</must_include>
<must_avoid>${JSON.stringify(entry.must_avoid)}</must_avoid>
<mechanisms>${JSON.stringify(mechanisms)}</mechanisms>
<buyer>${JSON.stringify(buyer)}</buyer>
<voice>${JSON.stringify(voice)}</voice>
<previous_section_ending>${previousEnding || "(this is the first section)"}</previous_section_ending>

Write ${section.target_words} words. Second person.

Cover every must_include point. Do not add scope beyond the brief — other sections handle what you might be tempted to include.

Never use: ${(voice.banned_phrases || []).join(", ")}.

Return prose only. No headings, no preamble, no meta-commentary.`,
    { json: false, maxTokens: 2000, ...ctx }
  );
}
