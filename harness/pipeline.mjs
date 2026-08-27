/** Lazy so --mock runs with no SDK installed and no key. */
let _client;
async function getClient() {
  if (_client !== undefined) return _client;
  if (!process.env.ANTHROPIC_API_KEY) {
    _client = null;
    return _client;
  }
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  _client = new Anthropic();
  return _client;
}

const MODELS = {
  extract: "claude-sonnet-4-6",
  build: "claude-opus-4-6",
  critic: "claude-opus-4-6",
  writer: "claude-sonnet-4-6",
};

const usage = { input: 0, output: 0, calls: 0 };
export const getUsage = () => ({ ...usage });

/** Rough USD estimate. Update when pricing changes. */
export function estimateCost() {
  return (usage.input / 1e6) * 5 + (usage.output / 1e6) * 25;
}

async function ask(model, prompt, { json = true, maxTokens = 8000 } = {}) {
  const client = await getClient();
  if (!client) throw new Error("ANTHROPIC_API_KEY not set — run with --mock or export a key");
  const res = await client.messages.create({
    model,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  });
  usage.calls++;
  usage.input += res.usage.input_tokens;
  usage.output += res.usage.output_tokens;
  const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
  if (!json) return text;
  const clean = text.replace(/^```(?:json)?\s*/m, "").replace(/```\s*$/m, "").trim();
  try {
    return JSON.parse(clean);
  } catch {
    const start = clean.indexOf("{");
    const end = clean.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("No JSON in response: " + clean.slice(0, 300));
    return JSON.parse(clean.slice(start, end + 1));
  }
}

// ---------------------------------------------------------------- stages

export async function extractAudience(creator) {
  return ask(MODELS.extract, `You are analyzing a creator's public content to build an audience profile that will drive a paid digital product.

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
{"who":"...","core_promise":"...","vocabulary":[...],"audience_words":[...],"objections":[...],"tone_notes":"...","credibility_basis":"...","confidence":{"who":0-1,"core_promise":0-1,"objections":0-1},"evidence":{"who":["..."],"core_promise":["..."]}}`);
}

export async function proposeTopics(audienceCard, duration = 30) {
  return ask(MODELS.build, `You are proposing digital product topics for this creator.

<audience_card>${JSON.stringify(audienceCard, null, 2)}</audience_card>

The product archetype is fixed: a quiz diagnoses the buyer, then they receive a personalized ${duration}-day transformation plan as a PDF, priced $20-50.

Generate 8 candidates internally. Score each 1-10 on:
- acuteness: felt weekly or daily right now? Merely interesting scores 3 or below.
- segmentability: would two buyers with different situations need genuinely different plans? If one plan serves everyone, personalization is theater — score 3 or below.
- resolvability: real change in ${duration} days, no purchases, under 20 min/day?
- credibility: is this creator obviously the right person, given credibility_basis?

Reject any candidate below 6 on segmentability or below 5 on acuteness regardless of total.

Return JSON only:
{"proposals":[{"topic_title":"...","promise":"...","scores":{"acuteness":n,"segmentability":n,"resolvability":n,"credibility":n},"why_this_works":"...","segmentation_preview":["4-6 buyer situations needing different plans"],"risk":"..."}]}

Return the top 4. If fewer than 4 survive the rejection rules, return fewer and add {"insufficient": true}.`);
}

export async function buildKnowledgePack(topic, audienceCard) {
  return ask(MODELS.build, `Build the domain knowledge base for this product. Everything downstream cites from this and nothing else.

<topic>${JSON.stringify(topic)}</topic>
<audience_card>${JSON.stringify(audienceCard)}</audience_card>

SEGMENTS — 6 to 10 slices split by ROOT CAUSE, not symptom severity or demographics.
MECHANISMS — 6 to 12 interventions, each with a why_it_works explaining the causal chain in plain language. "It works because it builds consistency" is not a mechanism. If you cannot state the mechanism, drop the intervention.
FALSE_BELIEFS — 4 to 6 wrong beliefs with defensible corrections, drawn from the objections where possible.
GLOSSARY — terms the plan will use, one line each.

Rules: no intervention requiring a purchase; flag contested items with "contested":true and state both sides; mark uncertain claims "confidence":"low" rather than omitting them.

Return JSON only:
{"segments":[{"id":"seg_...","label":"...","prevalence":"high|medium|low","root_cause":"..."}],"mechanisms":[{"id":"mech_...","name":"...","why_it_works":"...","applies_to_segments":[...]}],"false_beliefs":[{"belief":"...","correction":"..."}],"glossary":{"term":"definition"}}`);
}

export async function designQuiz(knowledgePack, audienceCard, skeleton) {
  return ask(MODELS.build, `Design the diagnostic quiz and archetype resolution rules.

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
{"questions":[{"id":"q_...","question":"...","type":"single|multi","required":true,"drives":[...],"modifies":[...],"options":[{"value":"...","label":"...","signals":{"key":"value"}}]}],"archetype_rules":[{"id":"arch_...","label":"...","priority":n,"archetype_rationale":"what makes this plan different","match":{"all":[{"signal":"...","in":[...]}]}}],"fallback_archetype":"arch_general"}`);
}

export async function writeBrief({ knowledgePack, archetype, rationale, section, voice, earlier }) {
  return ask(MODELS.build, `Write the content brief for one section of one archetype's plan.

<knowledge_pack>${JSON.stringify(knowledgePack)}</knowledge_pack>
<archetype>${archetype} — ${rationale}</archetype>
<section>${section.id}: ${section.title}, target ${section.target_words} words</section>
<voice>${JSON.stringify(voice)}</voice>
<already_written>${JSON.stringify(earlier)}</already_written>

You are writing a BRIEF, not prose. The brief tells a writer what must be conveyed for this specific person. The writer produces the actual words later, with the buyer's real details.

Return JSON only:
{"brief":"2-4 sentences on what this section must accomplish FOR THIS ARCHETYPE. If it would read the same for a different archetype, it is wrong — rewrite it.","must_include":["3-5 points concrete enough that their absence is checkable"],"must_avoid":["2-4 items, including failure modes specific to this archetype"],"mechanism_refs":["ids from the knowledge pack"]${section.id.startsWith("week") ? ',"week_theme":"3-5 words"' : ""}}

${section.id.startsWith("week") ? "Week sections must fit the smallest stated time budget, state what changes from the previous week and why now, and name one thing the buyer should NOT do yet." : ""}`, { maxTokens: 2000 });
}

export async function renderSection({ entry, mechanisms, buyer, voice, section, previousEnding }) {
  return ask(MODELS.writer, `Write one section of a personalized plan.

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

Return prose only. No headings, no preamble, no meta-commentary.`, { json: false, maxTokens: 2000 });
}

// ---------------------------------------------------------------- critics

const criticSchema = `Return JSON only: {"pass":true|false,"score":1-10,"failures":[{"path":"...","issue":"...","fix":"..."}]}`;

export async function knowledgeCritic(pack) {
  return ask(MODELS.critic, `Audit this knowledge pack for a paid product.

<knowledge_pack>${JSON.stringify(pack)}</knowledge_pack>

1. Every mechanism has a real causal explanation, not a restatement of the outcome.
2. No factual claim that is wrong or materially outdated. Flag specifics.
3. Segments split by cause, not severity. Two segments that would receive the same plan are one segment.
4. Corrections are defensible, not merely contrarian.
5. Nothing requires a purchase.

Be adversarial. A pack that passes with no findings is more likely under-reviewed than perfect.

${criticSchema}`);
}

export async function quizCritic(quiz, pack, audienceWords) {
  return ask(MODELS.critic, `Audit this quiz.

<quiz>${JSON.stringify(quiz)}</quiz>
<knowledge_pack>${JSON.stringify(pack)}</knowledge_pack>
<audience_words>${JSON.stringify(audienceWords)}</audience_words>

For EACH question, state which archetypes it separates. If a question separates none, it fails.

Then check: can a buyer answer every question about themselves without expertise; does any question ask for self-diagnosis rather than observation; are archetypes genuinely distinguishable or do several collapse into one plan; does the language match audience_words; is any archetype unreachable; is the first question answerable in under two seconds.

Give exact fixes, not general notes.

${criticSchema}`);
}

export async function outputCritic(archetype, section, rubric) {
  return ask(MODELS.critic, `Score this plan section against the rubric. You are reviewing a $27 product a real person paid for.

<archetype>${archetype}</archetype>
<section>${section}</section>
<rubric>${JSON.stringify(rubric)}</rubric>

For specificity, apply the test literally: pick any paragraph. Could it be sent unchanged to a buyer of a different archetype? If yes, that paragraph fails and you must quote it.

Score each rubric dimension 1-10 with a one-line justification and at least one quoted example. Scores without quoted evidence are invalid.

Return JSON only: {"pass":true|false,"scores":{"<rubric_id>":{"score":n,"why":"...","evidence":"quoted"}},"weighted":n,"failures":[...]}`);
}

export async function claimsCritic(section, domain, bannedClaims) {
  return ask(MODELS.critic, `Review for claims risk. Domain: ${domain}.

<section>${section}</section>
<banned_claims>${JSON.stringify(bannedClaims)}</banned_claims>

Flag outcome guarantees, medical or financial advice presented as certain, anything needing professional supervision, missing disclaimers, and claims contradicting mainstream guidance without acknowledging disagreement.

Err toward flagging. A false positive costs a rewrite. A false negative costs the creator's license.

${criticSchema}`);
}

// ------------------------------------------------- swap test (no model)

const bigrams = (text) => {
  const w = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
  const out = new Set();
  for (let i = 0; i < w.length - 1; i++) out.add(w[i] + " " + w[i + 1]);
  return out;
};

/** Token-level divergence between two rendered sections, 0-100. */
export function divergence(a, b) {
  const A = bigrams(a), B = bigrams(b);
  if (!A.size && !B.size) return 0;
  let shared = 0;
  for (const g of A) if (B.has(g)) shared++;
  const union = A.size + B.size - shared;
  return Math.round((1 - shared / union) * 100);
}

export function swapTest(renders, pairs, minPct) {
  const results = pairs.map(([a, b]) => {
    const sections = Object.keys(renders[a] || {}).filter((s) => renders[b]?.[s]);
    const scores = sections.map((s) => ({ section: s, pct: divergence(renders[a][s], renders[b][s]) }));
    const avg = scores.length ? Math.round(scores.reduce((t, s) => t + s.pct, 0) / scores.length) : 0;
    return { pair: [a, b], avg, sections: scores };
  });
  const overall = results.length
    ? Math.round(results.reduce((t, r) => t + r.avg, 0) / results.length)
    : 0;
  return { pass: overall >= minPct, overall, results };
}
