# Setup in Cursor

Everything runs locally. Nothing depends on a sandbox.

## 1. Put the files in a folder

```
blueprint/
├── blueprint-schema.md          reference: the data contract
├── build-pipeline-prompts.md    reference: every prompt in the chain
├── pawcraft.blueprint.json      golden standard, validates clean
├── validate-blueprint.js        deterministic validator
└── harness/
    ├── package.json
    ├── .env.example
    ├── README.md
    ├── run.mjs                  orchestrator
    ├── pipeline.mjs             stages + critics + swap test
    ├── mock.mjs                 fake stages, no API
    ├── ingest.mjs               inbox/*.md → creators.real.json
    ├── scrape.mjs               ScrapeCreators → inbox/*.md
    ├── creators.json            10 synthetic creators
    └── inbox/_template.md
```

Open the `blueprint/` folder in Cursor. Node 20+ required (`node -v`).

## 2. Install and smoke-test

```bash
cd harness
npm install
npm test          # runs the full chain in mock mode — no keys, no cost
```

You should see 10 creators, 7 passing, `sourdough` halting at `no_viable_topic`
and `language_spanish` halting at `swap_test`. If you see that, the plumbing is
correct and every gate fires.

## 3. Add keys

```bash
cp .env.example .env
```

Fill in both keys. Then either export them or use a loader:

```bash
export $(grep -v '^#' .env | xargs)
```

Node 20.6+ can also do `node --env-file=.env run.mjs ...`.

## 4. First real run — one creator, small

```bash
node scrape.mjs somehandle --inspect     # confirm response shapes, ~2 credits
```

Read the dumped JSON. If captions or comments came back empty, the field probes
in `scrape.mjs` (`captionOf`, `commentTextOf`, `postsOf`) need tightening against
the real shape. This is the step worth doing carefully — it costs 2 credits here
and a lot of confusion if skipped.

```bash
node scrape.mjs handle1 handle2 handle3  # ~6 credits each
# open inbox/*.md, fill in self_description + expectation
node ingest.mjs
node run.mjs --input creators.real.json --only handle1
```

That last command is one creator against the real Anthropic API — roughly $2-4
and a few minutes. Read the samples in `runs/<timestamp>/handle1/samples/` before
running the other nine.

## 5. Full run

```bash
node run.mjs --input creators.real.json --concurrency 3
```

Roughly $15-40 for ten. Results in `runs/<timestamp>/scores.csv`.

## Where you'll most likely get stuck

**Response shapes.** ScrapeCreators doesn't publish nested schemas, so the
extractors probe several plausible paths. `--inspect` is how you resolve it.
Symptom: `0 captions` or `0 comments` in the scrape output.

**JSON parsing from the model.** `ask()` in `pipeline.mjs` strips code fences and
falls back to brace-matching, but a stage can still return prose. Symptom: a
creator halts at `exception` with a JSON error. Fix by tightening the "Return
JSON only" line in that stage's prompt.

**Model names.** `MODELS` at the top of `pipeline.mjs` — update if the strings
have moved on.

**Structural validation failures.** Expected on early runs. `structural_errors`
in the CSV tells you the count; `records.json` has the first three with exact
fixes. Those errors are the validator doing its job, not a bug.

## What to do with Cursor itself

The two reference docs are worth keeping open as context. `blueprint-schema.md`
defines the data contract and `build-pipeline-prompts.md` has every prompt — when
you want to change how a stage behaves, that's the file to edit, and the change
flows into `pipeline.mjs` as a prompt string.

`pawcraft.blueprint.json` is the target. When a generated blueprint looks thin,
diff its `content_bank` briefs against PawCraft's. That comparison is usually
more informative than the rubric scores.
