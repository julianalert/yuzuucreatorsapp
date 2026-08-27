# Quality harness

Runs the full build chain against 10 synthetic creators in different niches and
reports whether output quality survives automation. No product code, no auth,
no Stripe. This is the experiment that decides whether to build the SaaS.

## Run

```bash
npm install @anthropic-ai/sdk
export ANTHROPIC_API_KEY=sk-...

node run.mjs --mock            # plumbing test, no API calls, no key needed
node run.mjs                   # full run, ~$15-40 total
node run.mjs --only houseplants,budget_debt
node run.mjs --concurrency 3
```

Output lands in `runs/<timestamp>/`:

```
scores.csv                     one row per creator, all gate results
records.json                   full stage detail
<creator>/blueprint.json       the generated blueprint
<creator>/samples/*.md         rendered sections, per archetype
```

## The creators are not random

Each one tests something specific:

| Creator | What it tests |
|---|---|
| `sleep_toddler` | Control. Structurally closest to PawCraft — should score well or the pipeline is broken. |
| `houseplants` | Highly diagnostic, low stakes. Should be the easiest win. |
| `sourdough` | Low segmentability trap. The pipeline should **refuse** to produce a topic. If it doesn't, segmentability scoring is too generous. |
| `language_spanish` | Long time-to-result. Stresses the 30-day resolvability score. |
| `budget_debt` | Financial, tier high. Must produce disclaimers and refuse specific advice. |
| `adhd_focus`, `public_speaking` | Mental-health adjacent. Tests whether the pipeline stays out of therapy territory. |
| `run_first5k`, `strength_over40` | Injury risk. Tests safety escalation. |
| `freelance_pricing` | B2B, claims-sensitive. |

A run where all 10 pass is a bad sign, not a good one — it means the gates
aren't discriminating.

## Reading the results

1. **Anything halted at `swap_test`** — the archetypes weren't materially
   different. That's a stage 4 failure, not a stage 5 one. Look at the quiz.
2. **`dim_specificity` across niches** — the dimension that degrades first
   under automation. If it's above 7 everywhere, the pipeline works. If it's
   6-7, the briefs are too vague. Below 6, the archetypes are wrong.
3. **Did sourdough get rejected?** The pipeline refusing a niche is a feature.
4. **`structural_errors`** — should be 0 after one retry. Persistent errors mean
   the stage 4 prompt isn't constraining the model enough.

## The decision rule

- **8+ of 10 pass** — build the product.
- **5-7 pass** — build it, but gate the allowed niches to the ones that worked
  and add a waitlist for the rest.
- **3-4 pass** — the archetype is too broad. Narrow to one vertical.
- **Under 3** — the two-phase split isn't the problem. Revisit whether the
  knowledge pack stage is doing real work.

## Notes

- Mock mode runs serially; the mock keeps per-creator state in module scope.
  Real runs parallelize safely.
- Only 3 of 8 sections are rendered per archetype (`EVAL_SECTIONS` in `run.mjs`)
  and only the first 4 archetypes. Full rendering is wasteful at this stage.
- The swap test runs before the output critic because it's free and catches the
  failure that makes an expensive critic pass pointless.

---

# Running against real creators

## The short version

```bash
export SCRAPECREATORS_API_KEY=...
node scrape.mjs theirhandle --inspect        # confirm response shapes once
node scrape.mjs handle1 handle2 handle3      # → inbox/*.md
# fill in self_description + expectation in each file
node ingest.mjs                              # → creators.real.json
node run.mjs --input creators.real.json --only handle1   # start with ONE
```

Or skip the scraper and paste by hand: `cp inbox/_template.md inbox/theirhandle.md`.

Do one creator first and read the samples yourself before spending money on ten.

## Scraping with ScrapeCreators

```bash
export SCRAPECREATORS_API_KEY=...

node scrape.mjs theirhandle --inspect     # FIRST RUN: dump raw JSON, confirm shapes
node scrape.mjs handle1 handle2 handle3   # fills inbox/*.md
node scrape.mjs --file handles.txt
```

Then fill in the two TODOs each file keeps (`self_description` and
`expectation`), and run `node ingest.mjs` as usual.

**Run `--inspect` on one handle before anything else.** The field extractors
probe several plausible paths rather than hardcoding one, because response
shapes aren't a stable contract. If captions or comments come back empty,
`--inspect` shows you the real shape and you tighten `captionOf` / `commentTextOf`
in `scrape.mjs`.

### What it does that a generic scraper doesn't

- **Comments are a first-class endpoint** (`/v2/instagram/post/comments`), which
  is the whole reason to use them over Apify. Comments are the highest-value
  input in the pipeline and the part generic scrapers handle worst.
- **Pulls comments from the most-discussed posts, not the most recent.** That's
  where people describe their own problem instead of just reacting.
- **Filters for problem language.** Drops praise, tag chains, emoji-only, and
  duplicates, then ranks what's left by first-person problem markers ("I", "my",
  "how do I", question marks). Twenty good comments beat two hundred raw ones.
- **Caches every response to `.cache/`.** Re-running to re-tune the filters costs
  zero credits. Use `--force` to bypass.

### Cost and reliability

Roughly 2 + N credits per creator, where N is the number of posts pulled for
comments (default 4). About 6 credits each, so **ten creators fits inside the
100 free credits.**

Their comments endpoint is documented at roughly 90% success. The script
degrades rather than failing — a `!` in the output means one post's comments
didn't come back. It flags any creator that ends up with fewer than 8 usable
comments so you can paste more by hand before running.

### Still paste when it matters

For the 2-3 creators you actually intend to approach, read their comments
yourself and hand-pick. The filter is good at bulk; you're better at spotting
the one comment that reveals what the product should be.

## Picking the ten

Don't pick ten creators you like. Pick ten that disagree with each other:

- 2 that should obviously work (highly diagnostic, low stakes)
- 2 in regulated or risky domains (health, money) — you're testing the safety gates
- 2 with long time-to-result — testing whether 30 days is honest
- 2 you suspect have low segmentability — you want the pipeline to **refuse**
- 2 real prospects you'd actually approach

The refusals matter as much as the passes. A pipeline that never says no is a
pipeline that will ship a bad product under a creator's name.

## Write your prediction first

The `## expectation` field in the template isn't decoration. Fill it in before
running. When the result contradicts your prediction, that's the finding — and
it's the only way to tell a real signal from you reading the CSV charitably.

## What to actually do with the output

The CSV is triage, not the answer. After the run:

1. **Read 3 samples yourself**, from different archetypes, for your 2 best
   creators. You are the calibration instrument here — the rubric was written
   from your taste, and this is where you check whether the critics inherited it.
2. **Where you disagree with the critic**, that's a rubric bug. Fix the rubric,
   don't fix the sample.
3. **The samples you'd be happy to sell** become the golden set. Store them in
   `eval.golden_samples` on the blueprint and score future runs against them.

## Talking to real creators

If you approach any of these people with a generated product, tell them it was
AI-generated and that you built it unprompted. Show them the samples before the
pitch. It's a better opening than a cold DM anyway, and it makes the approval
gate feel like a feature rather than a disclaimer.
