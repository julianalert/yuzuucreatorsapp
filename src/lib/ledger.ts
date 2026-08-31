import "server-only";
import { supabaseAdmin } from "./supabase/admin";
import type { LedgerEntryRow, OrderRow } from "./db/types";

/**
 * The ledger is the source of truth for what Yuzuu owes each creator —
 * never Stripe's balance, never a recomputed percentage.
 *
 *   sale    +creator_cents, payable 14 days after purchase (refund window)
 *   refund  −creator_cents, rides into the next payout if already paid out
 *   payout  −amount, written when a payout run is confirmed
 *
 * Balance = sum(amount_cents) where payout_id is null.
 */

/** Sales become payable this many days after purchase — the refund window. */
export const AVAILABLE_AFTER_DAYS = 14;

/** Minimum balance for a monthly payout; below it rolls forward. */
export const MIN_PAYOUT_CENTS = 5000;

/** Idempotent: the unique (order_id, kind) index makes re-deliveries no-op. */
export async function recordSale(
  order: Pick<OrderRow, "id" | "creator_cents" | "currency">,
  creatorId: string
): Promise<void> {
  const availableAt = new Date(
    Date.now() + AVAILABLE_AFTER_DAYS * 24 * 3600 * 1000
  ).toISOString();
  const { error } = await supabaseAdmin().from("ledger_entries").insert({
    creator_id: creatorId,
    order_id: order.id,
    kind: "sale",
    amount_cents: order.creator_cents ?? 0,
    currency: order.currency,
    available_at: availableAt,
  });
  // 23505 = unique violation: this sale is already on the ledger
  if (error && error.code !== "23505") {
    throw new Error(`ledger sale insert: ${error.message}`);
  }
}

/** Negative entry mirroring the sale. If the sale was already paid out, the
 * negative balance rides into the next payout run. Idempotent like recordSale. */
export async function recordRefund(
  order: Pick<OrderRow, "id" | "creator_cents" | "currency">,
  creatorId: string,
  externalRef?: string
): Promise<void> {
  const { error } = await supabaseAdmin().from("ledger_entries").insert({
    creator_id: creatorId,
    order_id: order.id,
    kind: "refund",
    amount_cents: -(order.creator_cents ?? 0),
    currency: order.currency,
    external_ref: externalRef ?? null,
  });
  if (error && error.code !== "23505") {
    throw new Error(`ledger refund insert: ${error.message}`);
  }
}

export interface CreatorBalance {
  /** Payable now: past the refund window, not yet in a payout. */
  availableCents: number;
  /** Earned but still inside the 14-day refund window. */
  pendingCents: number;
  /** Total already sent via confirmed payouts. */
  paidOutCents: number;
}

export async function creatorBalance(creatorId: string): Promise<CreatorBalance> {
  const { data } = await supabaseAdmin()
    .from("ledger_entries")
    .select("kind, amount_cents, available_at, payout_id")
    .eq("creator_id", creatorId);
  return balanceFromEntries((data ?? []) as LedgerEntryRow[]);
}

/** Pure math over a creator's entries — shared with the admin balances view. */
export function balanceFromEntries(
  entries: Pick<LedgerEntryRow, "kind" | "amount_cents" | "available_at" | "payout_id">[]
): CreatorBalance {
  const now = Date.now();
  let available = 0;
  let pending = 0;
  let paidOut = 0;
  for (const e of entries) {
    if (e.kind === "payout") {
      paidOut += -e.amount_cents;
      continue;
    }
    if (e.payout_id) continue; // already included in a confirmed payout
    const isPending =
      e.kind === "sale" && e.available_at !== null && new Date(e.available_at).getTime() > now;
    if (isPending) pending += e.amount_cents;
    else available += e.amount_cents;
  }
  return { availableCents: available, pendingCents: pending, paidOutCents: paidOut };
}

/** Entries a payout run would include: payable now and not yet paid out. */
export async function payableEntries(creatorId: string): Promise<LedgerEntryRow[]> {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabaseAdmin()
    .from("ledger_entries")
    .select("*")
    .eq("creator_id", creatorId)
    .is("payout_id", null)
    .neq("kind", "payout")
    .or(`available_at.is.null,available_at.lte.${nowIso}`)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`payable entries: ${error.message}`);
  return (data ?? []) as LedgerEntryRow[];
}
