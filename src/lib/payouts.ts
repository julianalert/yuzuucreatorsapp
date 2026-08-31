import "server-only";
import { supabaseAdmin } from "./supabase/admin";
import { MIN_PAYOUT_CENTS, payableEntries } from "./ledger";
import type { PayoutRow } from "./db/types";

/**
 * The monthly payout run, fully manual on the money side:
 *
 *   draft   → a payouts row per creator owed ≥ $50 with confirmed details
 *   confirm → human action: stamps the included ledger entries, writes the
 *             negative payout entry, status 'sent'
 *   paid    → human action after the actual bank/PayPal transfer
 *
 * Nothing here moves money. Webhooks record facts; humans send transfers.
 */

/** Creators eligible for a draft: details confirmed, no run already open. */
export async function draftPayoutRuns(): Promise<{ created: number; skipped: string[] }> {
  const admin = supabaseAdmin();
  const skipped: string[] = [];

  const { data: creators } = await admin
    .from("creators")
    .select("id, handle")
    .eq("payout_status", "ready");

  let created = 0;
  for (const c of creators ?? []) {
    const { data: open } = await admin
      .from("payouts")
      .select("id")
      .eq("creator_id", c.id)
      .in("status", ["draft", "sent"])
      .limit(1);
    if (open?.length) {
      skipped.push(`@${c.handle ?? c.id}: run already open`);
      continue;
    }

    const entries = await payableEntries(c.id);
    const total = entries.reduce((s, e) => s + e.amount_cents, 0);
    if (total < MIN_PAYOUT_CENTS) {
      if (total > 0) skipped.push(`@${c.handle ?? c.id}: $${(total / 100).toFixed(2)} under minimum`);
      continue;
    }

    const oldest = entries[0]?.created_at ?? new Date().toISOString();
    const { error } = await admin.from("payouts").insert({
      creator_id: c.id,
      amount_cents: total,
      currency: "usd",
      status: "draft",
      period_start: oldest,
      period_end: new Date().toISOString(),
    });
    if (error) throw new Error(`payout draft insert: ${error.message}`);
    created++;
  }
  return { created, skipped };
}

/**
 * The point of no return for the ledger (not for money — that's still yours
 * to send). Recomputes from live entries so a refund that landed after the
 * draft is included.
 */
export async function confirmPayout(payoutId: string): Promise<PayoutRow> {
  const admin = supabaseAdmin();
  const { data: payout } = await admin.from("payouts").select("*").eq("id", payoutId).single();
  if (!payout) throw new Error("payout not found");
  if (payout.status !== "draft") throw new Error(`payout is ${payout.status}, not draft`);

  const entries = await payableEntries(payout.creator_id);
  const total = entries.reduce((s, e) => s + e.amount_cents, 0);
  if (total < MIN_PAYOUT_CENTS) {
    await admin.from("payouts").delete().eq("id", payoutId);
    throw new Error(
      `balance dropped to $${(total / 100).toFixed(2)} (under minimum) — draft removed`
    );
  }

  const ids = entries.map((e) => e.id);
  const { error: stampErr } = await admin
    .from("ledger_entries")
    .update({ payout_id: payoutId })
    .in("id", ids)
    .is("payout_id", null);
  if (stampErr) throw new Error(`stamping entries: ${stampErr.message}`);

  const { error: entryErr } = await admin.from("ledger_entries").insert({
    creator_id: payout.creator_id,
    kind: "payout",
    amount_cents: -total,
    currency: "usd",
    payout_id: payoutId,
  });
  if (entryErr) throw new Error(`payout ledger entry: ${entryErr.message}`);

  const { data: updated, error } = await admin
    .from("payouts")
    .update({ amount_cents: total, status: "sent", period_end: new Date().toISOString() })
    .eq("id", payoutId)
    .select("*")
    .single();
  if (error) throw new Error(`payout update: ${error.message}`);
  return updated as PayoutRow;
}

/** After you've actually sent the money. */
export async function markPayoutPaid(payoutId: string, externalRef: string): Promise<PayoutRow> {
  const admin = supabaseAdmin();
  const { data: payout } = await admin.from("payouts").select("*").eq("id", payoutId).single();
  if (!payout) throw new Error("payout not found");
  if (payout.status !== "sent") throw new Error(`payout is ${payout.status}, not sent`);

  const { data: updated, error } = await admin
    .from("payouts")
    .update({ status: "paid", external_ref: externalRef || null })
    .eq("id", payoutId)
    .select("*")
    .single();
  if (error) throw new Error(`payout update: ${error.message}`);
  return updated as PayoutRow;
}
