import Link from "next/link";
import { redirect } from "next/navigation";
import { requireCreator } from "@/lib/auth";
import { latestBuild, routeForBuild } from "@/lib/builds";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { AppBar } from "@/components/AppBar";
import type { Blueprint } from "@/lib/blueprint/types";
import type { BlueprintRow, OrderRow } from "@/lib/db/types";

function countLastWeek(orders: OrderRow[]): number {
  const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
  return orders.filter((o) => new Date(o.created_at).getTime() > weekAgo).length;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ published?: string }>;
}) {
  const { published } = await searchParams;
  const creator = await requireCreator();
  const admin = supabaseAdmin();

  const { data: bpRow } = await admin
    .from("blueprints")
    .select("*")
    .eq("creator_id", creator.id)
    .eq("published", true)
    .maybeSingle();

  // no live product: send them wherever their build is (or to onboarding)
  if (!bpRow) {
    const build = await latestBuild(creator.id);
    const route = routeForBuild(build);
    if (route !== "/dashboard") redirect(route);
    redirect("/onboard");
  }

  const blueprint = bpRow as BlueprintRow;
  const bp = blueprint.data as Blueprint;

  const { data: orderRows } = await admin
    .from("orders")
    .select("*")
    .eq("blueprint_id", blueprint.id)
    .in("status", ["paid", "generating", "delivered"])
    .order("created_at", { ascending: false });
  const orders = (orderRows ?? []) as OrderRow[];

  const sold = orders.length;
  const earned = orders.reduce((sum, o) => sum + o.amount_cents, 0) / 100;
  const thisWeek = countLastWeek(orders);

  const labelFor = (archetype: string | null) =>
    bp.quiz.archetype_rules.find((r) => r.id === archetype)?.label ?? "—";

  const url = `yuzuu.co/u/${creator.handle}`;
  const initial = creator.display_name?.[0] ?? creator.email[0];

  return (
    <section>
      <AppBar initial={initial} />
      <div className="wrap wide">
        {published ? (
          <div className="notice" style={{ marginBottom: 26 }}>
            Your product is live. Put the link in your bio and tell your audience about it.
          </div>
        ) : null}

        <div className="micro">Your product</div>
        <h1 style={{ marginTop: 14 }}>{bp.product.topic_title}</h1>

        <div className="live" style={{ marginTop: 26 }}>
          <span className="badge">Live</span>
          <span className="url">{url}</span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
            <Link className="btn btn-outline btn-sm" href={`/u/${creator.handle}`}>
              View page
            </Link>
            <Link className="btn btn-ghost btn-sm" href="/onboard?new=1">
              Build a new product
            </Link>
          </div>
        </div>

        <div className="stats">
          <div className="stat">
            <span className="k">Plans sold</span>
            <div className="v">{sold}</div>
            <div className="sub">{thisWeek} in the last 7 days</div>
          </div>
          <div className="stat">
            <span className="k">Earned</span>
            <div className="v">${earned.toFixed(0)}</div>
            <div className="sub">${(blueprint.price_cents / 100).toFixed(0)} per plan</div>
          </div>
          <div className="stat">
            <span className="k">Version</span>
            <div className="v">v{blueprint.version}</div>
            <div className="sub">
              approved {blueprint.approved_at ? new Date(blueprint.approved_at).toLocaleDateString() : "—"}
            </div>
          </div>
        </div>

        <div className="card" style={{ marginTop: 26 }}>
          <span className="micro">Recent buyers</span>
          {orders.length === 0 ? (
            <p style={{ marginTop: 16, fontSize: 14.5, color: "var(--sage)" }}>
              No buyers yet. Share {url} — every sale shows up here with the buyer&apos;s type.
            </p>
          ) : (
            <table className="tbl" style={{ marginTop: 14 }}>
              <thead>
                <tr>
                  <th>Buyer</th>
                  <th>Their type</th>
                  <th>Status</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {orders.slice(0, 12).map((o) => (
                  <tr key={o.id}>
                    <td>{o.buyer_email}</td>
                    <td>{labelFor(o.resolved_archetype)}</td>
                    <td className="mono">{o.status}</td>
                    <td className="mono">{new Date(o.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  );
}
