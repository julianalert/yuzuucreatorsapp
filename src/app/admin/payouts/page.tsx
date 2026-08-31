import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { Wordmark } from "@/components/Wordmark";
import { balanceFromEntries, MIN_PAYOUT_CENTS } from "@/lib/ledger";
import { generateDraftRun, markPayoutDetailsReady } from "./actions";
import type { LedgerEntryRow, PayoutRow } from "@/lib/db/types";

export const dynamic = "force-dynamic";

function usd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

interface CreatorLite {
  id: string;
  handle: string | null;
  email: string;
  payout_provider: string | null;
  payout_recipient_id: string | null;
  payout_status: string;
}

export default async function AdminPayoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ drafted?: string; skipped?: string; error?: string }>;
}) {
  await requireAdmin();
  const { drafted, skipped, error } = await searchParams;
  const admin = supabaseAdmin();

  const [{ data: entryRows }, { data: creatorRows }, { data: payoutRows }] = await Promise.all([
    admin.from("ledger_entries").select("creator_id, kind, amount_cents, available_at, payout_id"),
    admin
      .from("creators")
      .select("id, handle, email, payout_provider, payout_recipient_id, payout_status"),
    admin.from("payouts").select("*").order("created_at", { ascending: false }).limit(50),
  ]);

  const entries = (entryRows ?? []) as (Pick<
    LedgerEntryRow,
    "kind" | "amount_cents" | "available_at" | "payout_id"
  > & { creator_id: string })[];
  const creators = (creatorRows ?? []) as CreatorLite[];
  const payouts = (payoutRows ?? []) as PayoutRow[];
  const creatorById = new Map(creators.map((c) => [c.id, c]));

  const byCreator = new Map<string, typeof entries>();
  for (const e of entries) {
    const list = byCreator.get(e.creator_id) ?? [];
    list.push(e);
    byCreator.set(e.creator_id, list);
  }

  const rows = [...byCreator.entries()]
    .map(([creatorId, list]) => ({
      creator: creatorById.get(creatorId),
      balance: balanceFromEntries(list),
    }))
    .filter((r) => r.creator)
    .sort((a, b) => b.balance.availableCents - a.balance.availableCents);

  return (
    <section>
      <header className="bar">
        <div className="bar-in wide">
          <Wordmark href="/admin" />
          <span className="micro">Admin · Payouts</span>
        </div>
      </header>
      <div className="wrap wide">
        <h1>Payouts</h1>
        <p style={{ marginTop: 10, fontSize: 14.5, color: "var(--sage)", maxWidth: "68ch" }}>
          Draft creates a run for every creator owed ≥ {usd(MIN_PAYOUT_CENTS)} with confirmed
          payout details. Confirm locks the ledger; the money you send by hand, then mark paid.
        </p>

        {error ? (
          <div className="notice warn" style={{ marginTop: 18 }}>
            {error}
          </div>
        ) : null}
        {drafted !== undefined ? (
          <div className="notice" style={{ marginTop: 18 }}>
            Draft run: {drafted} payout{drafted === "1" ? "" : "s"} created.
            {skipped ? <> Skipped — {skipped}</> : null}
          </div>
        ) : null}

        <form action={generateDraftRun} style={{ marginTop: 20 }}>
          <button className="btn btn-primary btn-sm" type="submit">
            Generate draft run
          </button>
        </form>

        <h2 style={{ marginTop: 40 }}>Balances</h2>
        {rows.length === 0 ? (
          <p style={{ marginTop: 12, fontSize: 14.5, color: "var(--sage)" }}>
            No ledger activity yet — balances appear with the first real sale.
          </p>
        ) : (
          <table className="tbl" style={{ marginTop: 14 }}>
            <thead>
              <tr>
                <th>Creator</th>
                <th>Payable now</th>
                <th>Clearing</th>
                <th>Paid out</th>
                <th>Payout details</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ creator, balance }) => (
                <tr key={creator!.id}>
                  <td>@{creator!.handle ?? "—"}</td>
                  <td className="mono">{usd(balance.availableCents)}</td>
                  <td className="mono">{usd(balance.pendingCents)}</td>
                  <td className="mono">{usd(balance.paidOutCents)}</td>
                  <td>
                    {creator!.payout_status === "not_set" ? (
                      <span style={{ color: "var(--sage)" }}>not set</span>
                    ) : (
                      <>
                        {creator!.payout_provider} · {creator!.payout_recipient_id}{" "}
                        <span className="mono">({creator!.payout_status})</span>
                      </>
                    )}
                  </td>
                  <td>
                    {creator!.payout_status === "pending" ? (
                      <form action={markPayoutDetailsReady}>
                        <input type="hidden" name="creator_id" value={creator!.id} />
                        <button className="btn btn-outline btn-sm" type="submit">
                          Mark ready
                        </button>
                      </form>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <h2 style={{ marginTop: 40 }}>Runs</h2>
        {payouts.length === 0 ? (
          <p style={{ marginTop: 12, fontSize: 14.5, color: "var(--sage)" }}>No payout runs yet.</p>
        ) : (
          <table className="tbl" style={{ marginTop: 14 }}>
            <thead>
              <tr>
                <th>Creator</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Created</th>
                <th>Ref</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((p) => (
                <tr key={p.id}>
                  <td>@{creatorById.get(p.creator_id)?.handle ?? "—"}</td>
                  <td className="mono">{usd(p.amount_cents)}</td>
                  <td className="mono">{p.status}</td>
                  <td className="mono">{new Date(p.created_at).toLocaleDateString()}</td>
                  <td className="mono">{p.external_ref ?? "—"}</td>
                  <td>
                    <Link className="btn btn-ghost btn-sm" href={`/admin/payouts/${p.id}`}>
                      Statement
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
