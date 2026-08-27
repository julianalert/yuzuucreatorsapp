# Yuzuu

AI-built digital products for creators. A creator signs in with Google, gives their Instagram handle, picks one of five AI-generated product ideas, approves three sample plans, and gets a live quiz-to-personalized-plan product page at `yuzuu.co/u/<handle>`. Buyers take the quiz, pay, and receive a personalized plan — web, PDF, and email.

The marketing landing page lives in a **separate repo**. This repo is the app only: `/` redirects to `/dashboard` (signed in) or `/signup`.

## Stack

- **Next.js 16** (App Router, RSC, TypeScript) on Vercel
- **Supabase** — Postgres, Auth (Google only), Storage (private `pdfs` bucket)
- **Inngest** — background jobs (`blueprint-build`, `plan-generate`) with pause/resume via `waitForEvent`
- **Anthropic** (content generation) + **OpenAI gpt-5-mini** (extraction/critics) — routing configurable per role via env
- **ScrapeCreators** — Instagram ingestion
- **Resend** — transactional email; **@react-pdf/renderer** — PDFs

## Layout

| Path | What |
|---|---|
| `src/lib/pipeline/` | The build pipeline, ported verbatim from the harness (stages, critics, swap test, model routing, mock layer) |
| `src/lib/blueprint/` | Blueprint types + structural validator |
| `src/lib/inngest/` | `blueprint-build` and `plan-generate` job definitions |
| `src/app/onboard/` | Creator flow: handle → scanning → 5 ideas → building → sample review |
| `src/app/u/[handle]/` | Buyer flow: sales page → quiz → checkout (fake pay for now) |
| `src/app/order/[id]/` | Generating status → web plan output |
| `src/app/dashboard/` | Creator dashboard (live link, sales, recent buyers) |
| `src/app/admin/` | Build inspector, env-allowlisted via `ADMIN_EMAILS` |
| `supabase/migrations/` | Schema + RLS |
| `harness/` | The original offline quality harness, kept runnable (`cd harness && npm test`) |

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in at least the Supabase vars
npm run dev                   # app on :3000
npx inngest-cli@latest dev    # Inngest dev server, discovers /api/inngest
```

Set `PIPELINE_MOCK=true` in `.env.local` to run the entire product — onboarding, build, quiz, checkout, plan generation — with zero model calls and zero cost. Only Supabase (and the Inngest dev server) are needed in that mode.

Offline checks (no keys, no database):

```bash
npm test              # 23 unit tests: validator, archetype resolution, mock pipeline gates
cd harness && npm test  # original harness in mock mode
npm run build
```

## Supabase setup (one-time)

1. Create a project, then apply migrations: `npx supabase db push` (or paste `supabase/migrations/*.sql` into the SQL editor in order).
2. Auth → Providers: enable **Google** only. Add your OAuth client ID/secret from Google Cloud Console; authorized redirect URI is `https://<project-ref>.supabase.co/auth/v1/callback`.
3. Auth → URL configuration: set the site URL and add `http://localhost:3000/auth/callback` + your production `/auth/callback` to the redirect allowlist.
4. Storage: the `pdfs` bucket is created by migration 0001 (private; the app serves signed URLs).

RLS model: creators can only **read** their own rows through the browser key; every write and every buyer-facing read goes through server code with the service role, which also keeps blueprint IP (`content_bank`, `knowledge_pack`) off the wire. There are intentionally no anon policies.

## Deploy (Vercel)

1. Import the repo in Vercel, framework preset Next.js.
2. Set every variable from `.env.example` (Supabase URL/keys, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `SCRAPECREATORS_API_KEY`, `RESEND_API_KEY`, `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`, `NEXT_PUBLIC_APP_URL`, `ADMIN_EMAILS`, caps).
3. Connect the Vercel integration in the Inngest dashboard (or register `https://<app>/api/inngest` manually) so the two functions sync.
4. Verify a Resend domain and set `EMAIL_FROM` to match.
5. End-to-end check: sign in → run a real handle through onboarding → approve samples → take the quiz at `/u/<handle>` → fake-pay → confirm the plan renders, the PDF downloads, and the delivery email arrives.

Cost controls: `PIPELINE_KILL_SWITCH=true` stops every model call instantly; `DAILY_SPEND_CAP_USD` halts new build stages once the day's tracked spend crosses it; `PER_CREATOR_BUILD_LIMIT` caps live/completed builds per account (default 1; failed and declined attempts don't count). Per-build spend is tracked on `builds.cost_usd` and shown in `/admin`.

Stripe is intentionally not wired yet: checkout's **Pay now** creates a `paid` order and triggers generation. `orders.stripe_payment_intent` is already in the schema for when it lands.
