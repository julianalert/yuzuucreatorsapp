# Payments

Supersedes the Stripe sections of `v1-spec.md`. This is the source of truth
for how money moves through Yuzuu — the architecture decision, what was
actually implemented (file map below), and the monthly payout runbook.

## Setup

Yuzuu is a **Portuguese company**. Creators are **US** at first. Buyers are
assumed to be mostly US.

## The decision

**Yuzuu is the merchant of record, and v1 uses no Stripe Connect at all.**

Buyers pay Yuzuu on a plain Stripe account. Creators are vendors you owe money
to. You pay them **manually, once a month** — no Wise/batch-file integration,
no payout rail in the codebase. The admin payout run computes who is owed
what and produces a statement; the transfer itself is a human action.

```
buyer → hosted Stripe Checkout ($27 + tax via Stripe Tax), USD
      → funds settle to Yuzuu
      → webhook records the sale on the ledger (creator's 70%)
      → monthly: draft run → review statement → manual transfer → mark paid
```

Connect becomes worth it later (20-30 active creators, or creators wanting
self-serve payouts). The ledger is identical either way — migrating means
adding a rail, not restructuring.

## Pricing and tax

- The product is listed at **$27, tax-exclusive**. Checkout shows
  `Price $27` + tax as a separate line.
- Tax is computed by **Stripe Tax** (`automatic_tax: enabled`, line item
  `tax_behavior: "exclusive"`). **Which taxes get collected is entirely
  dashboard configuration** — origin address + registrations (Portuguese
  VAT/OSS, US states as thresholds are hit). Zero tax logic in the app.
- Because tax rides on top, **net of tax is always exactly the list price**,
  and the creator's 70% is a stable $18.90 per $27 sale.
- **USD only in v1.** `currency` is stored on every money row so EUR can be
  added later. Never sum across currencies.

## Money split

- The split applies to the **tax-exclusive price** (= net of tax).
- **All fees come out of Yuzuu's share** — Stripe processing, FX if any.
  Creators get a clean 70%.

Worked example, $27 sale with 6% sales tax:

| | |
|---|---|
| Buyer pays | $28.62 |
| Sales tax (remitted by Yuzuu via Stripe Tax) | $1.62 |
| Net | $27.00 |
| Creator (70% of net) | $18.90 |
| Yuzuu gross (30% of net) | $8.10 |
| Stripe processing | actual fee stored from the balance transaction |
| Yuzuu net | $8.10 − fees |

Every number is stored on the order at time of sale (`gross_cents`,
`tax_cents`, `net_cents`, `creator_cents`, `platform_cents`,
`stripe_fee_cents`). **Never recompute from percentages later.**

## The ledger

`ledger_entries` is the source of truth for what Yuzuu owes each creator —
never Stripe's balance, never a recomputed percentage.

| kind | amount | when |
|------|--------|------|
| `sale` | +creator_cents | webhook, on payment. `available_at = purchase + 14 days` |
| `refund` | −creator_cents | any refund (auto or Stripe dashboard) |
| `payout` | −run total | when a payout run is confirmed |
| `adjustment` | signed | manual corrections (SQL only for now) |

Balance = `sum(amount_cents) where payout_id is null`. The dashboard splits it
into **payable now** (past `available_at`) and **clearing** (inside the 14-day
refund window).

Idempotency: a unique partial index on `(order_id, kind)` means one sale entry
and one refund entry per order, ever — webhook re-deliveries no-op.

## The refund window

Sales become payable after **14 days** — almost every refund request arrives
in the first 48 hours, long before the money would leave.

- **Generation failed** → automatic: `planGenerate`'s `onFailure` marks the
  order failed, refunds the PaymentIntent, writes the negative ledger entry,
  and emails the buyer. No human involved.
- **Buyer requests one, within window** → refund from the Stripe dashboard.
  The `charge.refunded` webhook records it; the creator's balance drops.
- **After payout** → same, the negative rides into the next payout. If they
  never sell again, Yuzuu carries it — accepted for v1.
- **Chargeback** → same handling; Yuzuu absorbs the dispute fee in v1.

## Payouts (fully manual)

- **Minimum payout $50** (`MIN_PAYOUT_CENTS`); below it rolls forward.
- **Monthly**, on the 1st (cron drafts at 06:00 UTC). A predictable date
  beats a fast one.
- Creators enter payout details in the dashboard (provider + an email or
  short note — **never full bank numbers**); an admin flips them to `ready`
  in `/admin/payouts`. The draft run skips anyone not `ready`.
- Two-step, per the design rule *never pay anyone from a webhook*:
  1. **Draft** (cron or button) — creates a `payouts` row per eligible creator.
  2. **Confirm** (human) — you read the statement, then confirm: entries are
     stamped with the payout id, the negative `payout` entry is written,
     status → `sent`.
  3. **Send the money by hand** (PayPal, bank, whatever was agreed).
  4. **Mark paid** (+ optional transfer reference) — emails the creator.
- The payout detail page **is** the per-creator statement: sales, refunds,
  total, payout details, period. Printable. That's the accounting record and
  their invoice in one.

## Implementation map

| Piece | Where |
|-------|-------|
| Stripe client | `src/lib/stripe.ts` (lazy, `STRIPE_SECRET_KEY`) |
| Ledger helpers | `src/lib/ledger.ts` (`recordSale`, `recordRefund`, `creatorBalance`, `payableEntries`) |
| Payout run logic | `src/lib/payouts.ts` (`draftPayoutRuns`, `confirmPayout`, `markPayoutPaid`) |
| Checkout action | `src/app/u/[handle]/checkout/actions.ts` — order `pending_payment` → hosted Checkout session (metadata `order_id`, statement descriptor suffix = creator handle) |
| Webhook | `src/app/api/stripe/webhook/route.ts` — `checkout.session.completed`, `charge.refunded`. Signature-verified, fully idempotent |
| Auto-refund on failure | `planGenerate.onFailure` in `src/lib/inngest/functions.ts` |
| Monthly draft cron | `payoutsDraftCron` in `src/lib/inngest/functions.ts` (`0 6 1 * *`) |
| Creator balance UI | `src/app/dashboard/page.tsx` (+ payout details form in `actions.ts`) |
| Admin payout UI | `src/app/admin/payouts/` (balances, runs, statement, confirm, mark paid) |
| Buyer states | `src/app/order/[id]/page.tsx` (`pending_payment` / `failed` / `refunded`) |
| Schema | `supabase/migrations/0009_payments.sql` |
| Emails | `sendOrderRefunded` (buyer), `sendPayoutPaid` (creator) in `src/lib/email.ts` |

Order lifecycle: `pending_payment → paid → generating → delivered`, with
`failed` (generation, auto-refunded) and `refunded` as exits. The webhook is
the only place `paid` is set; `order/paid` Inngest events are deduped by
event id.

### Env

```
STRIPE_SECRET_KEY=       # sk_test_... / sk_live_...
STRIPE_WEBHOOK_SECRET=   # whsec_... (endpoint: /api/stripe/webhook)
```

Webhook events to subscribe: `checkout.session.completed`, `charge.refunded`.

## One-time setup checklist (Stripe dashboard)

1. Create/confirm the Stripe account; **verify it can settle and hold USD**
   (Portuguese account — otherwise FX eats the margin twice).
2. Enable **Stripe Tax**: origin address, default product tax category
   (digital goods), registrations (PT VAT/OSS; US states as thresholds hit).
   Turn on threshold monitoring from the first sale.
3. Set the account statement descriptor to `YUZUU`.
4. Register the webhook endpoint (`/api/stripe/webhook`) for the two events;
   put the signing secret in `STRIPE_WEBHOOK_SECRET`.
5. Get a **US EIN** (needed to register in any US state later).

## Monthly payout runbook

On the 1st (the cron has already drafted; or press **Generate draft run** in
`/admin/payouts`):

1. For each new creator: check payout details, W-9 on file, agreement signed →
   **Mark ready**. Not ready = skipped; their balance rolls forward.
2. Open each draft's **Statement**. Read the lines — sales, refunds, total.
3. **Confirm** — locks the ledger for that run.
4. Send the money by hand (PayPal/bank per their details).
5. **Mark paid** with your transfer reference — the creator gets an email.
6. File the statement (print/PDF) for the books — a PT company paying US
   individuals needs the record.

## Compliance you still own (not in code)

- **Creator agreement** — revenue share, schedule, $50 minimum, who eats
  refunds/chargebacks, termination. One page, click-through, before first
  payout (`creators.agreement_signed_at`).
- **W-9 from every US creator** before their first payout — you cannot
  retroactively collect from creators who stopped answering email.
- **Tax advisor** before creator #10: marketplace-facilitator status, state
  nexus (200-transaction thresholds arrive before revenue ones), 1099
  obligations for a non-US platform. Stripe Tax monitoring covers the
  watching, not the deciding.
- **Withholding** (Modelo 21-RFI / US residence certificates) — deliberately
  not engineered yet; revisit with the advisor. The spec's
  `withholding_rate` column is omitted until then.
- **Don't spend the float** — between sale and payout, creator money sits in
  Yuzuu's account.

## When to switch to Connect

- More than 20-30 active creators, or the monthly run takes over an hour
- Creators want self-serve onboarding or faster-than-monthly payouts
- The first real manual-reconciliation error

The migration is adding a rail: Express accounts, transfers keyed off the
same ledger. Nothing in the ledger or order schema changes.
