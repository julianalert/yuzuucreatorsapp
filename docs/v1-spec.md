# v1 spec

## What we are building

A SaaS where creators get an AI-built digital product and a hosted page to sell it.

A creator submits their Instagram handle. An agent pipeline proposes topics, they
pick one, the pipeline builds a **blueprint** (the data artifact defining their
product), the creator approves three sample outputs, and the product goes live at
`/c/theirhandle`. Their audience takes a quiz, pays, and receives a personalized
30-day plan as a PDF.

The reference implementation of the pipeline already exists in `harness/`. It has
been run against real creators and debugged. **Port it, do not reinvent it.**

## Non-goals for v1

Explicitly out of scope. Do not build these:

- Creator customization of design, copy, or layout. UI is uniform for everyone.
- Multiple product archetypes. Only the transformation-plan archetype exists.
- Creator-editable blueprints. They approve or reject; they don't edit fields.
- Analytics dashboards beyond a sales count and a revenue total.
- Affiliate systems, coupons, upsells, order bumps, email sequences.
- Mobile apps.
- Multi-language. English only.

## Stack

- **Next.js 15, App Router, TypeScript, React Server Components**
- **Supabase** — Postgres, Auth (creators), Storage (PDFs)
- **Inngest** — background jobs. This is not optional: a blueprint build takes
  several minutes across many model calls and will exceed any serverless request
  timeout. Every pipeline stage is an Inngest step with its own retry.
- **Stripe Connect (Express)** — creators onboard their own account; platform
  takes an application fee. Buyers pay the creator, platform never holds funds.
- **Resend** — transactional email (plan delivery, creator notifications)
- **Anthropic SDK** — the pipeline
- **ScrapeCreators** — Instagram ingestion
- **PDF**: React-PDF (`@react-pdf/renderer`) rendered in an Inngest step.
  Do not use Playwright/Puppeteer — it's heavy on serverless and the layout is
  simple enough not to need a browser.
- **Vercel** for hosting

## Data model

```sql
creators (
  id uuid pk,
  user_id uuid references auth.users,
  handle text unique not null,          -- instagram handle, also the URL slug
  display_name text,
  email text not null,
  stripe_account_id text,
  stripe_onboarded boolean default false,
  created_at timestamptz default now()
)

builds (                                 -- one per pipeline attempt
  id uuid pk,
  creator_id uuid references creators,
  status text not null,                  -- queued|running|awaiting_topic|awaiting_approval|failed|complete
  stage text,                            -- current stage id, for the progress UI
  halted_at text,                        -- gate name if it stopped: swap_test, structural_validation, ...
  scrape_data jsonb,                     -- raw ScrapeCreators payloads
  audience_card jsonb,
  topic_proposals jsonb,
  chosen_topic jsonb,
  critic_results jsonb,                  -- every critic's output, for debugging
  error text,
  cost_usd numeric,
  created_at timestamptz default now(),
  completed_at timestamptz
)

blueprints (
  id uuid pk,
  creator_id uuid references creators,
  build_id uuid references builds,
  version int not null,
  status text not null,                  -- draft|complete|approved|archived
  data jsonb not null,                   -- the full blueprint, matching blueprint-schema.md
  approved_at timestamptz,
  approved_by uuid,
  published boolean default false,
  price_cents int default 2700,
  created_at timestamptz default now(),
  unique (creator_id, version)
)

samples (                                -- the three the creator reviews
  id uuid pk,
  blueprint_id uuid references blueprints,
  archetype text not null,
  sections jsonb not null,               -- { section_id: prose }
  pdf_path text,
  created_at timestamptz default now()
)

orders (
  id uuid pk,
  blueprint_id uuid references blueprints,
  blueprint_version int not null,        -- frozen: which version they bought
  buyer_email text not null,
  quiz_answers jsonb not null,
  resolved_archetype text,
  resolved_signals jsonb,
  stripe_payment_intent text unique,
  amount_cents int not null,
  status text not null,                  -- pending_payment|paid|generating|delivered|failed
  created_at timestamptz default now()
)

outputs (
  id uuid pk,
  order_id uuid references orders unique,
  sections jsonb not null,
  pdf_path text,
  generation_ms int,
  cost_usd numeric,
  created_at timestamptz default now()
)
```

Constraints that matter:

- Exactly one blueprint per creator may have `published = true`. Enforce with a
  partial unique index.
- `orders.blueprint_version` is copied at purchase time, never joined live. A
  buyer's product must not change when the creator publishes v2.
- RLS: creators read/write only their own rows. Public reads only published
  blueprints, and only the fields the sales page needs — never `data.content_bank`
  or `data.knowledge_pack`, which are the creator's IP.

## Routes

### Public

| Route | What it does |
|---|---|
| `/` | Marketing page. Static. |
| `/c/[handle]` | Creator's sales page. Topic title, promise, credibility, price, CTA. Server-rendered from the published blueprint. |
| `/c/[handle]/quiz` | The quiz. One question per screen, progress bar, back button. Answers held client-side until checkout. |
| `/c/[handle]/checkout` | Stripe Checkout redirect. Quiz answers stored on the order first. |
| `/order/[id]` | Post-payment status. Polls while generating, then shows the download. |

### Creator (auth required)

| Route | What it does |
|---|---|
| `/onboard` | Handle → scrape → build starts. Shows live stage progress. |
| `/onboard/topic` | The 4 topic proposals with scores and segmentation preview. Creator picks one. |
| `/onboard/review` | Three sample plans from different archetypes. Approve or reject with a reason. |
| `/onboard/payment` | Stripe Connect Express onboarding. |
| `/dashboard` | Sales count, revenue, link to their page, blueprint status. |

### Internal

| Route | What it does |
|---|---|
| `/api/inngest` | Inngest handler |
| `/api/stripe/webhook` | `checkout.session.completed` → mark paid → trigger generation |
| `/admin` | Every build, its stage, its critic scores, its cost. Gated by an env allowlist. |

## Jobs

### `blueprint.build` — the long one

One Inngest function, one `step.run` per pipeline stage so each retries
independently and a failure doesn't restart the whole thing.

```
scrape          → ScrapeCreators: profile, posts, comments (see harness/scrape.mjs)
extract         → audience card;  halt if min confidence < 0.5
propose         → 4 topics;       PAUSE, wait for creator choice
knowledge       → knowledge pack → knowledgeCritic, ≤2 retries
quiz            → quiz+archetypes → structural validator, then quizCritic, ≤2 retries
briefs          → content bank for the archetypes being sampled
render          → 3 samples, different archetypes
swap_test       → deterministic; on fail, regenerate the QUIZ stage, not the briefs
critique        → output critic; claims critic if tier high
gate            → weighted ≥ 7.5 → status complete → PAUSE, wait for creator approval
```

Pause and resume with `step.waitForEvent`. Write `builds.stage` before each step
so the progress UI is real rather than a fake spinner.

### `plan.generate` — the fast one

Triggered by the Stripe webhook.

```
resolve archetype   → validate-blueprint.js resolveArchetype(), pure function
render sections     → all 8, in PARALLEL (step.run each), from the frozen blueprint
assemble + PDF      → React-PDF → Supabase Storage
deliver             → Resend email with the link; mark order delivered
```

Target under 90 seconds. Cache by `(blueprint_version, archetype, token hash)` —
popular archetypes will hit cache often, which cuts cost and variance.

## Porting the harness

`harness/pipeline.mjs` holds every prompt and every critic. Port it to
`lib/pipeline/` as TypeScript with typed returns. Rules:

- **Prompts move verbatim.** They have been tuned against real runs. If a prompt
  needs changing, change it deliberately and note why — do not "improve" wording
  in passing.
- `validate-blueprint.js` moves to `lib/blueprint/validate.ts` with types, same
  logic. Both gates stay: structural (early) and coverage (at `complete`).
- `swapTest` and `resolveArchetype` are pure — port them and unit test them.
- `harness/mock.mjs` becomes the test fixture layer so the app's tests run
  without API calls.
- Keep the harness runnable. It stays the place to test pipeline changes cheaply
  before they hit the app.

## Acceptance criteria

v1 is done when all of these hold:

1. A creator signs up, submits a handle, and reaches topic selection without
   manual intervention.
2. Choosing a topic produces a blueprint that passes structural validation and
   scores ≥ 7.5 weighted.
3. The creator sees three samples from three different archetypes and can
   approve or reject. Rejection with a reason triggers a rebuild.
4. Approval publishes `/c/[handle]` and it renders server-side.
5. A buyer completes the quiz, pays via Stripe, and receives a PDF by email in
   under 3 minutes.
6. Two buyers with materially different quiz answers receive materially
   different PDFs. Verify with the swap test on real orders, not just samples.
7. Publishing v2 of a blueprint does not change any existing buyer's product.
8. `/admin` shows every build's stage, critic scores, and cost.
9. `npm test` passes without network access.

## Build order

Do not build this all at once. Each phase should be demoable.

**Phase 1 — pipeline as a library.** Port the harness to `lib/`. No UI. Prove it
with a script that builds a blueprint from a handle and writes it to Postgres.
Tests pass offline.

**Phase 2 — creator flow.** Auth, onboarding, Inngest jobs, topic selection,
sample review, approval. Still no public page, no payments.

**Phase 3 — public page and quiz.** `/c/[handle]`, the quiz, archetype
resolution. Fake the payment — go straight to generation.

**Phase 4 — payments and delivery.** Stripe Connect, webhook, PDF, email.

**Phase 5 — admin and hardening.** `/admin`, RLS audit, cost caps, rate limits.

Stop after each phase and report what works before starting the next.

## Things that will go wrong

**Model returns prose instead of JSON.** The harness handles it in `ask()` with
fence-stripping and brace-matching. Keep that. When a stage fails repeatedly,
fix the prompt's "Return JSON only" instruction rather than adding more parsing.

**Blueprint builds cost money.** Cap it: a per-creator build limit, a global
daily spend ceiling, and a kill switch env var. Log `cost_usd` on every build.

**ScrapeCreators response shapes.** The harness probes several paths on purpose
because nested schemas aren't published. Keep the probing; do not hardcode one
path because it worked once.

**Creators with thin content.** Under 8 usable comments produces a weak audience
card. Detect it at scrape time and ask the creator to paste more, rather than
building something mediocre with their name on it.

**A niche the pipeline can't serve.** Some creators will fail the gates. Build
the "we can't serve this niche yet" path in phase 2. Shipping a bad product under
a creator's name is worse than declining.
