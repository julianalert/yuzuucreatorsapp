import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { Wordmark } from "@/components/Wordmark";
import type { BuildRow } from "@/lib/db/types";

export const dynamic = "force-dynamic";

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
