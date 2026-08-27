# Blueprint schema

The blueprint is the data artifact that encodes one creator's product. It is generated once during the build phase, evaluated by critics, approved by the creator, then frozen and versioned. Runtime reads it and never modifies it.

## Three layers, kept strictly separate

| Layer | Scope | Changes | Owned by |
|---|---|---|---|
| **Archetype** | All creators | Rarely, by you | Platform code |
| **Blueprint** | One creator | Only via new version + re-approval | Build pipeline |
| **Session** | One end user | Every purchase | Runtime |

The archetype is the shared skeleton: quiz → signals → archetype match → sectioned N-day plan → PDF. Same for a dog trainer and a sleep coach. This is why the UI can stay uniform.

The blueprint is the domain substance poured into that skeleton.

The session is one buyer's answers plus the assembled output. Nothing about the product is decided at session time.

---

## The signal layer — the most important design decision

Naive branching maps one answer to one content block. That produces mechanically personalized output that reads like a mail merge, and it fails the swap test.

Instead, quiz answers emit **signals** (small typed facts), signals combine into an **archetype** (a diagnostic identity), and the content bank is keyed by archetype, not by answer.

```
answer "pulls hardest at the start of the walk"
  → signals: { arousal_pattern: "anticipatory", root_cause_hint: "under_stimulation" }

answer "18 months old"
  → signals: { life_stage: "adolescent" }

signals { adolescent + under_stimulation + high_energy_breed }
  → archetype: "arch_understimulated_adolescent"
  → the plan's diagnosis, week 1 track, and troubleshooting all key off that
```

This is what we were doing by hand in chat. The archetype is the thing that makes the reader feel understood, and it is the single highest-leverage field in the schema.

Target 8–15 archetypes per blueprint. Fewer than 6 means personalization is thin. More than 20 means the content bank is unmaintainable and most archetypes will be undertested.

---

## Top-level structure

```json
{
  "blueprint_id": "bp_pawcraft_v3",
  "blueprint_version": 3,
  "archetype_version": "transformation_plan_v1",
  "status": "approved",
  "created_at": "2026-08-25T10:00:00Z",
  "approved_at": "2026-08-26T14:22:00Z",
  "approved_by": "creator:pawcraft",
  "supersedes": "bp_pawcraft_v2",

  "creator": { ... },
  "product": { ... },
  "knowledge_pack": { ... },
  "quiz": { ... },
  "output": { ... },
  "safety": { ... },
  "eval": { ... }
}
```

### `creator`

Extracted in build step 1 from the handle, bio, and pasted captions. Drives voice and credibility, nothing else.

```json
{
  "handle": "mypawcraft",
  "display_name": "PawCraft",
  "credibility_statement": "One line the buyer sees on the sales page.",
  "audience_card": {
    "who": "First-time owners of high-drive dogs, 25-45, suburban.",
    "core_promise": "A calm dog you can actually walk.",
    "vocabulary": ["reactivity", "threshold", "loose leash", "marker word"],
    "objections": ["I've tried three trainers", "My dog is different"],
    "tone_notes": "Direct, no baby talk, treats the owner as competent."
  }
}
```

### `product`

```json
{
  "topic_title": "The 30-Day Loose Leash Reset",
  "promise": "Walk your dog without your arm being pulled off, in 30 days.",
  "duration_days": 30,
  "phase_length_days": 7,
  "price_usd": 27,
  "format": "pdf"
}
```

### `knowledge_pack`

Generated in build step 3, before the quiz exists. Everything downstream must cite from here rather than from the model's general priors. This is the automated version of a context-OS brain.

- `segments[]` — the raw population slices with prevalence and root cause
- `mechanisms[]` — interventions with an explicit *why it works*, tagged to segments
- `false_beliefs[]` — what the audience wrongly believes, and the correction
- `glossary` — domain terms with the creator's preferred phrasing

A mechanism without a `why_it_works` field is rejected by the critic. That field is what separates a plan from a listicle.

### `quiz`

```json
{
  "questions": [
    {
      "id": "q_trigger_timing",
      "question": "When is the pulling worst?",
      "type": "single",
      "required": true,
      "options": [
        { "value": "start", "label": "The first five minutes",
          "signals": { "arousal_pattern": "anticipatory", "root_cause_hint": "under_stimulation" } }
      ],
      "drives": ["diagnosis", "week_1", "troubleshooting"]
    }
  ],
  "archetype_rules": [
    {
      "id": "arch_understimulated_adolescent",
      "label": "The under-exercised adolescent",
      "priority": 10,
      "match": {
        "all": [
          { "signal": "life_stage", "in": ["adolescent"] },
          { "signal": "root_cause_hint", "in": ["under_stimulation"] }
        ]
      }
    }
  ],
  "fallback_archetype": "arch_general_puller"
}
```

**Hard rules the validator enforces:**

1. Every question declares `drives` with at least one output section. A question that drives nothing gets cut — this is the rule that kills generic quizzes.
2. Every output section appears in at least one `drives` array.
3. Every archetype rule is reachable by at least one valid answer combination.
4. Every archetype has full content-bank coverage for every section it can reach.
5. `fallback_archetype` exists and is fully populated — no buyer ever gets an empty branch.
6. Quiz length 6–12 questions. Below 6, archetypes can't be distinguished; above 12, completion rate drops.

### `output`

```json
{
  "skeleton": [
    { "id": "diagnosis", "title": "What's actually happening with {dog_name}", "target_words": 350 },
    { "id": "mechanism", "title": "Why the usual advice failed you", "target_words": 300 },
    { "id": "week_1", "title": "Week 1 — {week_1_theme}", "target_words": 700 },
    { "id": "week_2", "title": "Week 2", "target_words": 700 },
    { "id": "week_3", "title": "Week 3", "target_words": 700 },
    { "id": "week_4", "title": "Week 4", "target_words": 700 },
    { "id": "troubleshooting", "title": "When it goes sideways", "target_words": 500 },
    { "id": "regression", "title": "If you lose ground", "target_words": 250 }
  ],
  "content_bank": {
    "diagnosis::arch_understimulated_adolescent": {
      "brief": "What the writer must convey, as a brief — not final prose.",
      "must_include": ["name the specific pattern", "the 4-14 month arousal window"],
      "must_avoid": ["blaming the owner", "implying the dog is dominant"],
      "mechanism_refs": ["mech_arousal_threshold"]
    }
  },
  "personalization_tokens": ["dog_name", "breed", "age_months", "minutes_per_day"],
  "voice": {
    "reading_level": "grade 8",
    "person": "second",
    "banned_phrases": ["furbaby", "unlock", "game-changer", "In today's world"],
    "sentence_rhythm": "Short. Vary length. No stacked subordinate clauses."
  },
  "constraints": {
    "daily_time_budget_respected": true,
    "no_equipment_beyond": ["flat collar", "6ft lead", "treat pouch"]
  }
}
```

Note what `content_bank` entries are: **briefs, not prose**. Frozen prose across every buyer would be a template and would read like one. The brief fixes *what must be said* — the runtime writer decides *how*, using that buyer's specifics. That's the line between consistent quality and mail merge.

### `safety`

```json
{
  "domain_risk_tier": "low",
  "disclaimers": [],
  "banned_claims": ["guarantees results", "replaces veterinary advice"],
  "escalation_triggers": [
    { "signal": "bite_history", "equals": true,
      "action": "insert_referral_block", "block_id": "refer_behaviorist" }
  ]
}
```

Tier `high` (health, finance, legal) forces a claims critic and mandatory disclaimer blocks. Bloomia would be tier `high`.

### `eval`

Travels with the blueprint so quality is auditable per creator, not just at pipeline level.

```json
{
  "rubric": [
    { "id": "specificity", "weight": 0.3, "fail_below": 7,
      "test": "Could this paragraph be sent unchanged to a different archetype? If yes, fail." },
    { "id": "actionability", "weight": 0.25, "fail_below": 7,
      "test": "Can the reader do step one today with no purchase?" },
    { "id": "mechanism", "weight": 0.2, "fail_below": 6,
      "test": "Does it explain why, not just what?" },
    { "id": "voice_match", "weight": 0.15, "fail_below": 6 },
    { "id": "claims_safety", "weight": 0.1, "fail_below": 9 }
  ],
  "swap_test": { "persona_pairs": 6, "min_divergence_pct": 40 },
  "thresholds": { "min_weighted_score": 7.5, "max_regeneration_attempts": 2 },
  "golden_samples": ["sample_a.pdf", "sample_b.pdf", "sample_c.pdf"]
}
```

---

## How runtime consumes it

```
answers → signals → match archetype (highest priority wins, else fallback)
        → select content_bank briefs for each skeleton section
        → one writer call per section, given: brief + archetype + tokens + voice + mechanisms cited
        → assemble → render PDF
```

The writer call is deliberately narrow. It receives a brief, a voice spec, and the buyer's specifics, and it writes 350 words. It is not asked to decide what the product is. Sections can run in parallel; a 4,000-word plan comes back in well under a minute.

Cache aggressively: identical archetype plus identical token values means an identical section. Popular archetypes will hit cache often, which cuts both cost and variance.

## What the critics check, in order

1. **Structural validator** — deterministic code, not a model. The six hard rules above. Fails fast and cheap.
2. **Knowledge critic** — are mechanisms real, is anything hallucinated, does every mechanism have a why.
3. **Quiz critic** — is every question load-bearing, are archetypes distinguishable, is the language the audience's own.
4. **Output critic** — the rubric, run on 6 synthetic personas.
5. **Swap test** — deterministic diff. Under 40% divergence rejects the blueprint, not the output.
6. **Claims critic** — tier `high` only.
7. **Creator gate** — 3 samples from different archetypes, human approval, then freeze.
