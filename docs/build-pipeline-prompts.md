# Build pipeline — prompts and orchestration

Every stage below writes into the blueprint and reads only from earlier stages. No stage may invent domain facts that aren't in the knowledge pack — that constraint is what stops quality drifting between creators.

Model assignment: Opus for stages 2–5 and the critics, Sonnet for stage 1 and the runtime writer. Expect $8–20 per blueprint build, one time.

---

## Stage 0 — input contract

What the creator submits. Deliberately small.

```json
{
  "handle": "mypawcraft",
  "bio": "pasted from profile",
  "captions": ["5-10 recent post captions"],
  "comments": ["10-20 comments from their audience, optional but high value"],
  "self_description": "one free-text field: what do you help people with?"
}
```

Comments are the single highest-value optional input. They contain the audience's actual language and objections, which is most of what makes stage 1 good.

---

## Stage 1 — audience extraction

```
You are analyzing a creator's public content to build an audience profile that will
drive a paid digital product.

<creator_input>
{{handle}}
{{bio}}
{{captions}}
{{comments}}
{{self_description}}
</creator_input>

Extract only what the evidence supports. Where the evidence is thin, say so in the
confidence field rather than inventing a plausible-sounding profile.

Pay particular attention to the comments. The words the audience uses for their own
problem matter more than the words the creator uses. When they differ, record both.

Return JSON only:
{
  "who": "One paragraph. Demographics only where evidenced. Emphasize the situation
          they are in, not their age bracket.",
  "core_promise": "The transformation this creator implicitly sells, in one sentence.",
  "vocabulary": ["8-15 domain terms the creator or audience actually use"],
  "audience_words": ["5-10 phrases the AUDIENCE uses for their own problem, verbatim"],
  "objections": ["3-5 objections evidenced in comments or pre-empted in captions"],
  "tone_notes": "How this creator talks. Include what they never do.",
  "credibility_basis": "Why this audience trusts them. Credentials, results, or lived experience.",
  "confidence": { "who": 0-1, "core_promise": 0-1, "objections": 0-1 },
  "evidence": { "who": ["quoted fragment"], "core_promise": ["quoted fragment"] }
}
```

If any confidence score is below 0.5, the pipeline stops and asks the creator two clarifying questions rather than proceeding on a guess.

---

## Stage 2 — topic proposals

```
You are proposing digital product topics for this creator.

<audience_card>{{stage_1_output}}</audience_card>

The product archetype is fixed: a quiz diagnoses the buyer, then they receive a
personalized {{duration}}-day transformation plan as a PDF, priced $20-50.

Generate 8 candidate topics internally. Score each on four axes, 1-10:

- acuteness: is the pain felt weekly or daily, right now? A topic the audience
  merely finds interesting scores 3 or below.
- segmentability: would two buyers with different situations need genuinely
  different plans? If one plan serves everyone, personalization is theater —
  score 3 or below and expect rejection.
- resolvability: can a motivated person see real change in {{duration}} days
  with no purchases and under 20 minutes a day?
- credibility: is this creator obviously the right person to sell it, given
  their credibility basis?

Reject any candidate scoring below 6 on segmentability or below 5 on acuteness,
regardless of total.

Return the top 4 as JSON:
{
  "proposals": [{
    "topic_title": "Buyer-facing title. Concrete, specific, no wordplay.",
    "promise": "One sentence, in the audience's own words where possible.",
    "scores": { "acuteness": n, "segmentability": n, "resolvability": n, "credibility": n },
    "why_this_works": "Two sentences for the creator, not marketing copy.",
    "segmentation_preview": ["4-6 buyer situations that would receive
                             meaningfully different plans"],
    "risk": "The main reason this could fail, stated plainly."
  }]
}
```

Show the creator the scores and the segmentation preview. Creators pick better topics when they can see that a topic splits into real buyer situations — and it primes them for the approval gate later.

---

## Stage 3 — knowledge pack

The stage that carries the whole product. Run it before the quiz exists.

```
Build the domain knowledge base for this product. Everything downstream will cite
from this and nothing else.

<topic>{{chosen_topic}}</topic>
<audience_card>{{stage_1_output}}</audience_card>

Produce:

SEGMENTS — 6 to 10 population slices, split by ROOT CAUSE, not by symptom
severity or demographics. Two people with the same symptom and different causes
belong in different segments; that distinction is the product.

MECHANISMS — 6 to 12 interventions. Each needs a why_it_works that explains the
causal chain in plain language. "It works because it builds consistency" is not a
mechanism. If you cannot state the mechanism, drop the intervention.

FALSE_BELIEFS — 4 to 6 things this audience wrongly believes, with corrections.
Draw from the objections in the audience card where possible. Each correction must
be defensible, not merely contrarian.

GLOSSARY — domain terms the plan will use, defined in one line each.

Rules:
- No intervention that requires a purchase.
- Flag anything contested in the field with "contested": true and state both sides.
- If you are uncertain whether a claim is well-supported, mark it
  "confidence": "low" rather than omitting it. The critic will decide.

Return JSON matching the knowledge_pack schema.
```

---

## Stage 4 — quiz and archetypes

```
Design the diagnostic quiz and the archetype resolution rules.

<knowledge_pack>{{stage_3_output}}</knowledge_pack>
<audience_card>{{stage_1_output}}</audience_card>

Design in this order. Do not reverse it.

1. ARCHETYPES FIRST. Define 6-12 buyer identities from the segments. An archetype
   is a person in a situation, not a category label: "the adult who was never
   actually taught" beats "adult segment." Each archetype must lead to a
   materially different plan — different first week, different failure modes.

2. THEN the signals needed to distinguish them. A signal is a small typed fact:
   life_stage, root_cause_hint, time_budget_min.

3. THEN the questions that elicit those signals. 6-12 questions.

Constraints, enforced by a validator after you:
- Every question declares "drives": the output sections its answer changes.
  A question driving nothing must be deleted. No exceptions for
  "it builds rapport" or "it personalizes the intro."
- Every archetype must be reachable by at least one valid answer combination.
- Questions use the audience's own words from audience_words, not clinical terms.
- No question the buyer cannot answer confidently about themselves. Ask what they
  observe, not what they diagnose.
- Include one safety question if the domain has any escalation path.
- Order questions easy-to-hard. The first question must be answerable in
  under two seconds.

Also define fallback_archetype for unmatched combinations, and give it full
coverage — no buyer may receive an empty branch.

Return JSON matching the quiz schema, plus an "archetype_rationale" field per
archetype explaining what makes its plan different.
```

---

## Stage 5 — content bank

Run once per `(section, archetype)` pair. Parallelizable.

```
Write the content brief for one section of one archetype's plan.

<knowledge_pack>{{stage_3_output}}</knowledge_pack>
<archetype>{{archetype}} — {{archetype_rationale}}</archetype>
<section>{{section_id}}: {{section_title}}, target {{target_words}} words</section>
<voice>{{voice_spec}}</voice>
<already_written>{{briefs for earlier sections of this same archetype}}</already_written>

You are writing a BRIEF, not prose. The brief tells a writer what must be conveyed
for this specific person. The writer will produce the actual words later, with the
buyer's real details.

Return JSON:
{
  "brief": "2-4 sentences. What this section must accomplish FOR THIS ARCHETYPE
            specifically. If your brief would read the same for a different
            archetype, it is wrong — rewrite it.",
  "must_include": ["3-5 specific points. Concrete enough that their absence is
                    checkable. 'Explain the mechanism' is not checkable;
                    'name the 6-18 month arousal window and say it is temporary' is."],
  "must_avoid": ["2-4 items. Include failure modes specific to this archetype —
                  what would make THIS person stop reading."],
  "mechanism_refs": ["ids from the knowledge pack"],
  "week_theme": "3-5 words, week sections only"
}

Week sections additionally must:
- fit inside the buyer's stated time budget, the smallest one first
- state what changes from the previous week and why now
- name at least one thing the buyer should NOT do yet
```

---

## Critics

Each returns `{ "pass": bool, "score": 1-10, "failures": [{ "path": "...", "issue": "...", "fix": "..." }] }`. Failures feed back into a regeneration of that stage only, max 2 attempts, then human review.

### Knowledge critic (after stage 3)

```
Audit this knowledge pack for a paid product.

<knowledge_pack>{{stage_3_output}}</knowledge_pack>

Check each:
1. Every mechanism has a real causal explanation, not a restatement of the outcome.
2. No factual claim that is wrong or materially outdated. Flag specifics.
3. Segments split by cause, not by severity. If two segments would receive the
   same plan, they are one segment.
4. Corrections in false_beliefs are defensible, not just contrarian.
5. Nothing requires a purchase.

Be adversarial. A pack that passes without any findings is more likely
under-reviewed than perfect.
```

### Quiz critic (after stage 4)

```
Audit this quiz.

<quiz>{{stage_4_output}}</quiz>
<knowledge_pack>{{stage_3_output}}</knowledge_pack>
<audience_words>{{audience_words}}</audience_words>

For EACH question, state which archetypes it separates. If a question separates
none, it fails.

Then check:
1. Can a buyer answer every question about themselves without expertise?
2. Does any question ask for a self-diagnosis rather than an observation?
3. Are archetypes genuinely distinguishable, or do several collapse into one plan?
4. Does the language match audience_words?
5. Is any archetype unreachable?
6. Is the first question answerable in under two seconds?

For each failure give the exact fix, not a general note.
```

### Output critic (after stage 5, on rendered samples)

```
Score this plan section against the rubric. You are reviewing a $27 product a
real person paid for.

<archetype>{{archetype}}</archetype>
<section>{{rendered_section}}</section>
<rubric>{{eval.rubric}}</rubric>

For specificity, apply this test literally: pick any paragraph. Could it be sent
unchanged to a buyer of a different archetype? If yes, that paragraph fails and
you must quote it.

Score each rubric dimension 1-10 with a one-line justification and at least one
quoted example supporting the score. Scores without quoted evidence are invalid.
```

### Swap test — deterministic, no model

Render the same section for both archetypes in each configured pair. Normalize whitespace, tokenize, compute token-level divergence. Below `min_divergence_pct`, reject the **blueprint** — the archetypes aren't really different, so stage 4 must be regenerated, not stage 5.

This is the cheapest high-signal check in the pipeline. Run it before spending money on the output critic.

### Claims critic — `domain_risk_tier: high` only

```
Review for claims risk. Domain: {{domain}}.

<section>{{rendered_section}}</section>
<banned_claims>{{safety.banned_claims}}</banned_claims>

Flag: outcome guarantees, medical or financial advice presented as certain,
anything that would need a professional's supervision, missing required
disclaimers, and any claim contradicting mainstream guidance without
acknowledging the disagreement.

Err toward flagging. A false positive costs a rewrite. A false negative costs
the creator's license or the platform's liability.
```

---

## Runtime writer

Not part of the build. Runs once per section per buyer, in parallel.

```
Write one section of a personalized plan.

<brief>{{content_bank_entry.brief}}</brief>
<must_include>{{must_include}}</must_include>
<must_avoid>{{must_avoid}}</must_avoid>
<mechanisms>{{resolved mechanism objects, full text}}</mechanisms>
<buyer>{{personalization_tokens}}</buyer>
<voice>{{voice}}</voice>
<previous_section_ending>{{last 2 sentences, for continuity}}</previous_section_ending>

Write {{target_words}} words. Second person. Address {{dog_name}} by name where
natural, not in every paragraph.

Cover every must_include point. Do not add scope beyond the brief — other
sections handle what you might be tempted to include.

Never use: {{banned_phrases}}.

Return prose only. No headings, no preamble, no meta-commentary.
```

---

## Orchestration

```
1  extract_audience()            → confidence gate → clarifying Qs if low
2  propose_topics()              → creator picks
3  build_knowledge_pack()  → knowledge_critic       → retry ≤2
4  design_quiz()           → structural_validator   → retry ≤2 (cheap, run first)
                           → quiz_critic            → retry ≤2
5  build_content_bank()    → structural_validator (coverage)
6  render 6 synthetic personas
7  swap_test                     → fail ⇒ regenerate stage 4, not stage 5
8  output_critic on 3 sections × 6 personas
9  claims_critic if tier high
10 weighted score ≥ 7.5          → else human review queue
11 render 3 creator samples → approval gate → freeze, version, publish
```

Order matters at 7: the swap test is deterministic and nearly free, and it catches the failure mode that most often makes an expensive output critic run pointless.
