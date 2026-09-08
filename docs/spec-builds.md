# Spec builds

Build the product first, then pitch it. `/admin/spec` pre-builds a product from a
creator's public Instagram, gives you a private link to show them, and hands the
account over if they say yes.

This exists for the first ~50 creators. It is deliberately manual.

## Why there are no per-creator mailboxes

The only account a creator needs is a Yuzuu account. There are no per-creator
third-party credentials anywhere in this app: Yuzuu is merchant of record with no
Stripe Connect (`docs/payments.md`), Instagram is read from public data through one
platform-wide ScrapeCreators key, and all mail sends from one Resend domain.

So a spec account is minted directly with the service role — no mailbox, no
password, no Google account. Its address lives on `SPEC_EMAIL_DOMAIN`
(`build.yuzuu.co`), which never sends and only needs a free catch-all forward for
anything unforeseen.

## The flow

1. **Build.** `/admin/spec`, enter a handle. This creates the auth user
   (`email_confirm: true`, no password, no OAuth identity), a `creators` row with
   `is_spec = true`, and fires `build/requested`.
2. **The pipeline auto-picks.** A spec build skips the idea-pick wait and takes the
   first-ranked proposal — nobody is there to choose. It then halts at
   `awaiting_approval` like any other build, with `published = false`.
3. **Pitch.** Copy the preview link from the table:
   `/u/<handle>?preview=<token>`. It renders the sales page, quiz and checkout in
   preview mode. It cannot take payment, start a quiz session, log a visit or
   produce an OG image — those all resolve through `publishedProductByHandle()`,
   which only ever returns published rows.
4. **They say yes.** Enter their real email under "Hand over". That swaps
   `auth.users.email` and `creators.email`, and clears `is_spec`. They go to
   `/auth`, click Sign in with Google at that address, and Supabase links the new
   Google identity to the existing user — landing them on the finished product.
5. **They approve.** Normal `/onboard/review`. Their approval is what publishes,
   exactly as the landing page promises.
6. **They say no, or never answer.** Discard. The account, its build and its
   blueprint are deleted and the handle is free. The parked pipeline run is
   cancelled via `build/discarded`.

## Rules this relies on

- **Nothing publishes without the creator.** `published` stays false for the whole
  spec lifecycle; only `reviewSamples` (which needs their signed-in session) flips it.
- **A spec account never sends mail.** `is_spec` suppresses the declined, ideas-ready,
  samples-ready and review-reminder paths. Without that, 50 shadow accounts drip into
  the catch-all and an accepting creator inherits a backlog of stale nudges.
- **Handover needs a confirmed email.** Supabase refuses to auto-link an OAuth
  identity to an unverified address — that would be a pre-account-takeover. Both
  admin calls pass `email_confirm: true`.
- **The review wait is 60 days for spec builds**, not 14. It is an outreach cycle,
  not a deadline. It still expires so an unanswered pitch does not hold a handle
  forever.
- **A front-door signup beats a pitch.** If someone signs up for a handle we
  spec-built, `releaseSpecHandle()` deletes the spec account so our own outreach
  cannot block the signup it exists to cause.

## Setup

1. `SPEC_EMAIL_DOMAIN` in env (default `build.yuzuu.co`). Use a subdomain, never the
   sending domain — it keeps `yuzuu.co` deliverability out of it entirely.
2. Point a free catch-all forward at it (Cloudflare Email Routing) → your inbox.
   Receive-only is all that is needed.
3. Enable Supabase's Email provider, magic-link only, signups disabled. This is the
   handover fallback for a creator whose real address is not a Google account —
   `admin.generateLink({ type: 'magiclink' })` gives you a link to paste into a DM.
   Without it, handover to a non-Google address leaves them unable to sign in.
4. Watch cost. Fifty builds is real model spend. Run one real build, read
   `builds.cost_usd` on `/admin`, and set `DAILY_SPEND_CAP_USD` to pace the rest.
   `PIPELINE_KILL_SWITCH=true` stops everything.

## The line not to cross

Building from public data and keeping it unpublished is a pitch. Publishing someone's
handle, face and a live $27 checkout before they agreed is not — it is also the one
promise the landing page makes out loud ("Nothing publishes without your yes").

Discard on request, immediately, without asking why.
