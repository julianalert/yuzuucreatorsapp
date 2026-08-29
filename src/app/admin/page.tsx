import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { Wordmark } from "@/components/Wordmark";
import type { BuildRow } from "@/lib/db/types";

export const dynamic = "force-dynamic";

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

const DAY_MS = 24 * 60 * 60 * 1000;

interface ActivationRow {
  handle: string;
  daysLive: number;
  visits: number;
  quizStarts: number;
  sold: number;
  daysToFirstSale: number | null;
}

async function loadActivationRows(): Promise<ActivationRow[]> {
  const admin = supabaseAdmin();
  const now = Date.now();
  const { data } = await admin
    .from("blueprints")
    .select("id, approved_at, created_at, creators!inner(id, handle, first_sale_at)")
    .eq("published", true)
    .order("approved_at", { ascending: false });

  return Promise.all(
    (data ?? []).map(async (bp) => {
      const c = bp.creators as unknown as {
        id: string;
        handle: string | null;
        first_sale_at: string | null;
      };
      const liveAt = new Date(bp.approved_at ?? bp.created_at).getTime();
      const [{ count: visits }, { count: quizStarts }, { count: sold }] = await Promise.all([
        admin
          .from("creator_events")
          .select("id", { count: "exact", head: true })
          .eq("creator_id", c.id)
          .eq("type", "page_visit"),
        admin
          .from("quiz_sessions")
          .select("id", { count: "exact", head: true })
          .eq("creator_id", c.id),
        admin
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("blueprint_id", bp.id)
          .in("status", ["paid", "generating", "delivered"]),
      ]);
      return {
        handle: c.handle ?? "—",
        daysLive: Math.max(0, (now - liveAt) / DAY_MS),
        visits: visits ?? 0,
        quizStarts: quizStarts ?? 0,
        sold: sold ?? 0,
        daysToFirstSale: c.first_sale_at
          ? (new Date(c.first_sale_at).getTime() - liveAt) / DAY_MS
          : null,
      };
    })
  );
}

/**
 * The north-star view: published creators × their road to the first sale.
 * Activation = first paid order within 7 days of going live.
 */
async function ActivationSection() {
  const rows = await loadActivationRows();

  const published = rows.length;
  const activated = rows.filter((r) => r.daysToFirstSale !== null).length;
  const activated7d = rows.filter(
    (r) => r.daysToFirstSale !== null && r.daysToFirstSale <= 7
  ).length;
  // creators live ≥7 days (or already activated) — the denominator that's had a fair shot
  const matured = rows.filter((r) => r.daysLive >= 7 || r.daysToFirstSale !== null).length;

  return (
    <>
      <div className="stats">
        <div className="stat">
          <span className="k">Published creators</span>
          <div className="v">{published}</div>
          <div className="sub">with a live product</div>
        </div>
        <div className="stat">
          <span className="k">Activated</span>
          <div className="v">{activated}</div>
          <div className="sub">≥1 sale, all time</div>
        </div>
        <div className="stat">
          <span className="k">Activation rate (7d)</span>
          <div className="v">{matured ? Math.round((activated7d / matured) * 100) : 0}%</div>
          <div className="sub">first sale within 7 days of going live</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 26 }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Creator</th>
              <th>Days live</th>
              <th>Visits</th>
              <th>Quiz starts</th>
              <th>Sold</th>
              <th>Days to 1st sale</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.handle}>
                <td>@{r.handle}</td>
                <td className="mono">{r.daysLive.toFixed(1)}</td>
                <td className="mono">{r.visits}</td>
                <td className="mono">{r.quizStarts}</td>
                <td className="mono">{r.sold}</td>
                <td className="mono">
                  {r.daysToFirstSale === null ? "—" : r.daysToFirstSale.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default async function AdminPage() {
  await requireAdmin();
  const admin = supabaseAdmin();

  const { data: buildRows } = await admin
    .from("builds")
    .select("*, creators(handle, email)")
    .order("created_at", { ascending: false })
    .limit(50);
  const builds = (buildRows ?? []) as (BuildRow & {
    creators: { handle: string | null; email: string } | null;
  })[];

  const { count: orderCount } = await admin
    .from("orders")
    .select("id", { count: "exact", head: true });

  // quiz funnel, last 30 days — each status implies the earlier ones
  const since = isoDaysAgo(30);
  const { data: sessionRows } = await admin
    .from("quiz_sessions")
    .select("status, email")
    .gte("created_at", since);
  const sessions = (sessionRows ?? []) as { status: string; email: string | null }[];
  const RANK: Record<string, number> = { quiz_started: 0, quiz_completed: 1, checkout: 2, paid: 3 };
  const reached = (rank: number) => sessions.filter((s) => (RANK[s.status] ?? 0) >= rank).length;
  const funnel = {
    started: sessions.length,
    completed: reached(1),
    checkout: reached(2),
    paid: reached(3),
    emails: sessions.filter((s) => s.email).length,
  };
  const pct = (n: number) => (funnel.started ? Math.round((n / funnel.started) * 100) : 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayBuilds = builds.filter((b) => new Date(b.created_at) >= today);
  const todayCost = todayBuilds.reduce((s, b) => s + (b.cost_usd ?? 0), 0);
  const totalCost = builds.reduce((s, b) => s + (b.cost_usd ?? 0), 0);

  return (
    <section>
      <header className="bar">
        <div className="bar-in wide">
          <Wordmark href="/dashboard" />
          <span className="micro">Admin</span>
        </div>
      </header>
      <div className="wrap wide">
        <h1>Builds</h1>

        <div className="stats">
          <div className="stat">
            <span className="k">Spend today</span>
            <div className="v">${todayCost.toFixed(2)}</div>
            <div className="sub">
              cap ${process.env.DAILY_SPEND_CAP_USD ?? "50"} · {todayBuilds.length} builds today
            </div>
          </div>
          <div className="stat">
            <span className="k">Spend (last 50 builds)</span>
            <div className="v">${totalCost.toFixed(2)}</div>
            <div className="sub">
              ${builds.length ? (totalCost / builds.length).toFixed(2) : "0"} avg per build
            </div>
          </div>
          <div className="stat">
            <span className="k">Orders</span>
            <div className="v">{orderCount ?? 0}</div>
            <div className="sub">all time</div>
          </div>
        </div>

        <h1 style={{ marginTop: 40 }}>Quiz funnel</h1>
        <div className="stats">
          <div className="stat">
            <span className="k">Quizzes started</span>
            <div className="v">{funnel.started}</div>
            <div className="sub">last 30 days</div>
          </div>
          <div className="stat">
            <span className="k">Finished quiz</span>
            <div className="v">{funnel.completed}</div>
            <div className="sub">
              {pct(funnel.completed)}% of started · {funnel.emails} emails captured
            </div>
          </div>
          <div className="stat">
            <span className="k">Reached checkout</span>
            <div className="v">{funnel.checkout}</div>
            <div className="sub">{pct(funnel.checkout)}% of started</div>
          </div>
          <div className="stat">
            <span className="k">Paid</span>
            <div className="v">{funnel.paid}</div>
            <div className="sub">{pct(funnel.paid)}% of started</div>
          </div>
        </div>

        <h1 style={{ marginTop: 40 }}>Activation</h1>
        <ActivationSection />

        <div className="card" style={{ marginTop: 26 }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Creator</th>
                <th>Status</th>
                <th>Stage</th>
                <th>Halted at</th>
                <th>Cost</th>
                <th>Started</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {builds.map((b) => (
                <tr key={b.id}>
                  <td>@{b.creators?.handle ?? "—"}</td>
                  <td className="mono">{b.status}</td>
                  <td className="mono">{b.stage ?? "—"}</td>
                  <td className="mono">{b.halted_at ?? "—"}</td>
                  <td className="mono">${(b.cost_usd ?? 0).toFixed(2)}</td>
                  <td className="mono">{new Date(b.created_at).toLocaleString()}</td>
                  <td>
                    <Link href={`/admin/builds/${b.id}`} style={{ fontSize: 13.5 }}>
                      Inspect
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
