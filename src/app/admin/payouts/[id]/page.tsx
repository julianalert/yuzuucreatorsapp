import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { Wordmark } from "@/components/Wordmark";
import { payableEntries } from "@/lib/ledger";
import { confirmPayoutAction, markPaidAction } from "../actions";
import type { LedgerEntryRow, PayoutRow } from "@/lib/db/types";

export const dynamic = "force-dynamic";

function usd(cents: number): string {
  const sign = cents < 0 ? "−" : "";
  return `${sign}$${(Math.abs(cents) / 100).toFixed(2)}`;
}

/**
 * The per-creator statement: sales, refunds, total, payout details. For a
 * draft it previews the live payable entries; once confirmed it shows exactly
 * the entries stamped into this payout. Printable — this is the accounting
 * record and the creator's statement in one.
 */
export default async function PayoutStatementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const admin = supabaseAdmin();

  const { data: payoutRow } = await admin.from("payouts").select("*").eq("id", id).maybeSingle();
  if (!payoutRow) notFound();
  const payout = payoutRow as PayoutRow;

  const { data: creator } = await admin
    .from("creators")
    .select("id, handle, email, payout_provider, payout_recipient_id, payout_status")
    .eq("id", payout.creator_id)
    .single();

  let entries: LedgerEntryRow[];
  if (payout.status === "draft") {
    entries = await payableEntries(payout.creator_id);
  } else {
    const { data } = await admin
      .from("ledger_entries")
      .select("*")
      .eq("payout_id", id)
      .neq("kind", "payout")
      .order("created_at", { ascending: true });
    entries = (data ?? []) as LedgerEntryRow[];
  }
  const total = entries.reduce((s, e) => s + e.amount_cents, 0);
  const sales = entries.filter((e) => e.kind === "sale");
  const refunds = entries.filter((e) => e.kind === "refund");

  return (
    <section>
      <header className="bar">
        <div className="bar-in wide">
          <Wordmark href="/admin/payouts" />
          <span className="micro">Payout statement</span>
        </div>
      </header>
      <div className="wrap">
        <div className="micro">
          {payout.status === "draft" ? "Draft — nothing locked yet" : `Status: ${payout.status}`}
        </div>
        <h1 style={{ marginTop: 14 }}>@{creator?.handle ?? "unknown"}</h1>
        <p style={{ marginTop: 10, fontSize: 14.5, color: "var(--ink-soft)" }}>
          {creator?.email}
          <br />
          Pay via: <b>{creator?.payout_provider ?? "—"}</b> · {creator?.payout_recipient_id ?? "—"}
          <br />
          Period: {payout.period_start ? new Date(payout.period_start).toLocaleDateString() : "—"}{" "}
          → {payout.period_end ? new Date(payout.period_end).toLocaleDateString() : "now"}
          {payout.external_ref ? (
            <>
              <br />
              Transfer ref: <span className="mono">{payout.external_ref}</span>
            </>
          ) : null}
        </p>

        <table className="tbl" style={{ marginTop: 24 }}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Kind</th>
              <th>Order</th>
              <th style={{ textAlign: "right" }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id}>
                <td className="mono">{new Date(e.created_at).toLocaleDateString()}</td>
                <td>{e.kind}</td>
                <td className="mono">{e.order_id ? e.order_id.slice(0, 8) : "—"}</td>
                <td className="mono" style={{ textAlign: "right" }}>
                  {usd(e.amount_cents)}
                </td>
              </tr>
            ))}
            <tr>
              <td colSpan={3}>
                <b>
                  Total — {sales.length} sale{sales.length === 1 ? "" : "s"}
                  {refunds.length ? `, ${refunds.length} refund${refunds.length === 1 ? "" : "s"}` : ""}
                </b>
              </td>
              <td className="mono" style={{ textAlign: "right" }}>
                <b>{usd(payout.status === "draft" ? total : payout.amount_cents)}</b>
              </td>
            </tr>
          </tbody>
        </table>

        {payout.status === "draft" ? (
          <form action={confirmPayoutAction} style={{ marginTop: 26 }}>
            <input type="hidden" name="payout_id" value={payout.id} />
            <p style={{ fontSize: 14.5, color: "var(--sage)", marginBottom: 12, maxWidth: "62ch" }}>
              Read the lines above first. Confirming stamps these entries into this payout and
              locks the amount — the transfer itself is still yours to send.
            </p>
            <button className="btn btn-primary btn-sm" type="submit">
              Confirm payout of {usd(total)}
            </button>
          </form>
        ) : null}

        {payout.status === "sent" ? (
          <form action={markPaidAction} className="payout-form" style={{ marginTop: 26 }}>
            <input type="hidden" name="payout_id" value={payout.id} />
            <input
              type="text"
              name="external_ref"
              placeholder="Transfer reference (optional)"
            />
            <button className="btn btn-primary btn-sm" type="submit">
              Mark paid + email creator
            </button>
          </form>
        ) : null}

        <p style={{ marginTop: 30 }}>
          <Link className="btn btn-ghost btn-sm" href="/admin/payouts">
            Back to payouts
          </Link>
        </p>
      </div>
    </section>
  );
}
