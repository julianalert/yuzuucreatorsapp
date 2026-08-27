# CLAUDE.md

## What this is

An offline quality harness for a creator-product pipeline. It is an **experiment**,
not a product. The question it answers: does the quality of a hand-built product
(PawCraft) survive being generated automatically for arbitrary creators?

Do not build product features here. No auth, no Stripe, no Next.js app. If a task
starts drifting toward "the SaaS," stop and say so.

## The architecture in three lines

1. **Build phase** — expensive, slow, evaluated. Turns a creator's Instagram
   content into a `blueprint.json`, which is frozen and versioned.
2. **Runtime** — cheap, fast, deterministic. Reads the blueprint, takes an end
   user's quiz answers, assembles their personalized plan.
3. The split exists because quality came from human iteration, which cannot
   happen while a customer waits 30 seconds.

`blueprint-schema.md` is the data contract. `build-pipeline-prompts.md` has every
prompt. `pawcraft.blueprint.json` is the golden standard — it validates clean.

## Commands

```bash
npm test                                        # mock mode, no keys, no cost
node scrape.mjs <handle> --inspect              # dump raw API JSON (~2 credits)
node scrape.mjs h1 h2 h3                        # → inbox/*.md (~6 credits each)
node ingest.mjs                                 # inbox/*.md → creators.real.json
node run.mjs --input creators.real.json --only h1   # ~$2-4, ONE creator
node run.mjs --input creators.real.json --concurrency 3   # ~$15-40, all
```

**Never run the full pipeline without asking.** It costs real money. Default to
`--mock`, or `--only <one>` when a real call is genuinely needed. Say the
estimated cost before running anything that spends.

## Invariants — do not break these

**Content bank entries are briefs, not prose.** A brief says what must be
conveyed; the runtime writer produces the words for that specific buyer. If you
find yourself writing finished paragraphs into `content_bank`, that is a
template and it defeats the whole design.

**Quiz questions declare `drives` (sections they change) or `modifies`
(global: constraints, voice, safety, pacing).** A question that does neither gets
deleted. This is the rule that prevents generic quizzes. Do not relax it to make
a validation error go away.

**Archetypes come before signals, signals before questions.** Reversing that
order produces mechanical answer→content mapping, which fails the swap test.

**The swap test runs before the output critic.** It is deterministic and free,
and it catches the failure that makes an expensive critic pass pointless. Do not
reorder for convenience.

**Never set `status: "approved"` programmatically.** Approval comes from a human
creator reviewing samples. The validator enforces an approval record; do not
satisfy it by writing one.

**Structural errors are the validator working.** When a generated blueprint
fails validation, fix the stage 4 prompt so the model produces valid output —
do not loosen the validator.

## Layout

```
blueprint-schema.md          the data contract, annotated
build-pipeline-prompts.md    every prompt + orchestration order
pawcraft.blueprint.json      golden standard, 56 briefs, validates clean
validate-blueprint.js        deterministic gates + resolveArchetype()
harness/
  run.mjs                    orchestrator, gating, CSV output
  pipeline.mjs               stages, critics, swap test — prompts live here
  mock.mjs                   fake stages for --mock
  scrape.mjs                 ScrapeCreators → inbox/*.md
  ingest.mjs                 inbox/*.md → creators.real.json
  creators.json              10 synthetic creators, each testing something
  inbox/_template.md         hand-paste format
```

Prompts exist in two places: `build-pipeline-prompts.md` (reference, readable)
and `pipeline.mjs` (executed). When changing a prompt, change both, or the
reference silently rots.

## Debugging guide

**`0 captions` or `0 comments` from scrape.mjs** — response shape mismatch. Run
`--inspect`, look at the real JSON, tighten `captionOf` / `commentTextOf` /
`postsOf` in `scrape.mjs`. These deliberately probe several paths because
ScrapeCreators doesn't publish nested schemas.

**A creator halts at `exception` with a JSON error** — a stage returned prose.
`ask()` strips fences and brace-matches, but the fix belongs in the prompt: make
the "Return JSON only" instruction more forceful for that stage.

**Halt at `swap_test`** — the archetypes aren't materially different. This is a
stage 4 failure. Regenerate the quiz, not the content bank.

**Halt at `structural_validation`** — read `records.json` for the first three
errors with exact fixes.

**All 10 creators pass** — suspicious, not good. The gates aren't discriminating.
`sourdough` in particular should be rejected at topic proposal; if it produces a
topic, segmentability scoring is too generous.

## Optional: ScrapeCreators MCP

They ship an official MCP server, which is useful for the `--inspect` step —
you can call endpoints directly and see shapes without burning a script run.

```json
{
  "mcpServers": {
    "scrape-creators": {
      "command": "npx",
      "args": ["@scrape-creators/mcp"]
    }
  }
}
```

Verify against their docs before relying on it.

## Reading results

`runs/<timestamp>/scores.csv` is triage. The real signal:

- `dim_specificity` — the dimension that degrades first under automation. Above
  7 across niches means the pipeline works. 6-7 means briefs are too vague.
  Below 6 means the archetypes are wrong.
- Rendered samples in `runs/<timestamp>/<creator>/samples/` — a human has to read
  these. Where the human disagrees with the critic's score, the **rubric** is
  wrong, not the sample.
