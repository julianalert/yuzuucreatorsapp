# The prompt

Paste this into Cursor (or Claude Code) with all the documents listed at the
bottom in context.

---

## Paste this

You are building v1 of a SaaS that generates and hosts AI-built digital products
for content creators.

Read these first, in this order, before writing any code:

1. `v1-spec.md` — what to build. This is authoritative on scope, stack, data
   model, routes, jobs, and acceptance criteria.
2. `blueprint-schema.md` — the core data contract. Read this until you can
   explain the difference between the archetype layer, the blueprint, and a
   session without looking.
3. `build-pipeline-prompts.md` — every prompt in the generation chain.
4. `pawcraft.blueprint.json` — a complete, validating blueprint. This is the
   quality target, hand-built. When generated output looks thin, diff against
   this.
5. `harness/` — **the working reference implementation.** It has been run against
   real creators and debugged. Its prompts are tuned. Read `harness/README.md`,
   then `harness/pipeline.mjs`.

The single most important instruction: **the harness is the source of truth for
the pipeline.** Port it to TypeScript in `lib/`. Move the prompts verbatim. Do
not rewrite them, do not "improve" their wording, do not restructure the stages.
They were tuned against real runs and the reference documents may lag behind
them. Where a document and the harness code disagree, the code wins — tell me
about the disagreement rather than silently picking one.

Before you start, do these three things:

1. Run `cd harness && npm install && npm test`. It should pass with no API keys.
   Report what you see. If it doesn't pass, stop and tell me.
2. Read `harness/pipeline.mjs` and `validate-blueprint.js` and summarize, in your
   own words, what the two-phase architecture is and why build time and runtime
   are separated. If you can't articulate why, re-read `blueprint-schema.md`
   before proceeding — every design decision downstream depends on it.
3. List any place where `v1-spec.md` and the harness code disagree.

Then build **Phase 1 only** as defined in `v1-spec.md`: the pipeline ported to
`lib/` as typed TypeScript, wired to Postgres, provable by a script that builds a
blueprint from an Instagram handle. No UI, no payments, no auth yet.

Stop when Phase 1 is demoable and report. Do not start Phase 2 without me.

Hard constraints, which apply to every phase:

- Content bank entries are **briefs, not prose**. If you write finished
  paragraphs into `content_bank`, you have built a template and defeated the
  design.
- Quiz questions must declare `drives` or `modifies`. A question that changes
  nothing gets deleted. Never relax this to clear a validation error.
- Never set `status: "approved"` in code. Approval is a human action.
- When generated output fails structural validation, fix the **prompt** so the
  model produces valid output. Do not loosen the validator.
- The swap test runs before the output critic. It's deterministic and free.
- Never run the full pipeline against all creators without asking me. State the
  estimated cost before anything that spends money. Default to mock mode.
- No creator customization of design or copy anywhere in v1. Uniform UI.

Ask me questions before building if anything in the spec is ambiguous. I'd rather
answer five questions now than review a wrong Phase 1.

---

## Documents to include in context

Put all of these in the project folder:

```
CLAUDE.md                     ← agent instructions, invariants, debugging
v1-spec.md                    ← what to build
BUILD-PROMPT.md               ← this file
blueprint-schema.md           ← the data contract
build-pipeline-prompts.md     ← every prompt in the chain
pawcraft.blueprint.json       ← the quality target
validate-blueprint.js         ← deterministic gates
harness/                      ← YOUR fixed version, not the original
├── README.md
├── SETUP.md
├── package.json
├── run.mjs
├── pipeline.mjs
├── mock.mjs
├── scrape.mjs
├── ingest.mjs
├── creators.json
└── inbox/_template.md
```

In Cursor, add the folder to context with `@Codebase`, or `@` the individual
docs. `CLAUDE.md` is read automatically by Claude Code; in Cursor, either rename
it `.cursorrules` or reference it explicitly in the prompt.

## Before you paste

**Use your fixed harness, not mine.** You ran it and Claude Code repaired real
bugs. Whatever is in your working copy is more correct than what I generated.
The prompt above tells the agent to trust the code over the docs for exactly this
reason.

**Two things worth updating first**, if your Claude Code session changed them:

- If prompts in `harness/pipeline.mjs` changed, mirror the change into
  `build-pipeline-prompts.md`, or that document becomes actively misleading.
- If `validate-blueprint.js` gained or lost rules, update the rules list in
  `blueprint-schema.md`.

Five minutes of reconciliation now prevents the agent from following a stale
document for three phases.

## Environment

```bash
ANTHROPIC_API_KEY=
SCRAPECREATORS_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=
RESEND_API_KEY=
ADMIN_EMAILS=
PIPELINE_KILL_SWITCH=false
DAILY_SPEND_CAP_USD=100
```

Only the first three are needed for Phase 1.
