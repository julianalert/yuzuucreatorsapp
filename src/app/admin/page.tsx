import Link from "next/link";
import { AdminNav } from "@/components/admin/AdminNav";
import { requireAdmin } from "@/lib/admin";
import { loadDashboard, RANGES } from "@/lib/admin-metrics";
import { deltaPct, usd } from "@/lib/metrics";
import {
  CreatorStrip,
  Funnel,
  Histogram,
  RangeTabs,
  StatTile,
  TrendChart,
} from "@/components/admin/charts";

export const dynamic = "force-dynamic";

const days = (n: number | null) => (n === null ? "—" : n.toFixed(1));

/** Delta sized to sit beside a .stat .v headline number. */
function InlineDelta({ value }: { value: number | null }) {
  if (value === null) return null;
  const cls = value === 0 ? "flat" : value > 0 ? "up" : "down";
  return (
    <span className={`dv-delta ${cls}`} style={{ fontSize: 12, marginLeft: 6 }}>
      {value === 0 ? "±0%" : `${value > 0 ? "↑" : "↓"}${Math.abs(value)}%`}
    </span>
  );
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string }>;
}) {
  await requireAdmin();
  const { d } = await searchParams;
  const m = await loadDashboard(d);

  const { revenue, prevRevenue, economics, range } = m;
  const capUsd = process.env.DAILY_SPEND_CAP_USD ?? "50";
  const liveRows = m.creatorRows;
  const salesInPeriod = m.trends.sales.reduce((t, b) => t + b.value, 0);

  return (
    <section>
      <AdminNav current="/admin" />

      <div className="wrap wide">
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 20,
            flexWrap: "wrap",
          }}
        >
          <h1>Dashboard</h1>
          <RangeTabs ranges={RANGES} active={range.key} />
        </div>

        {/* ---------------------------------------------------------- headline */}
        <div className="stats four">
          <StatTile
            label="Revenue"
            value={usd(revenue.netCents)}
            sub={
              revenue.count
                ? `${revenue.count} ${revenue.count === 1 ? "sale" : "sales"} · ${usd(revenue.avgOrderCents)} avg`
                : "no sales over $5 yet"
            }
            delta={m.hasPrevious ? deltaPct(revenue.netCents, prevRevenue.netCents) : null}
          />
          <StatTile
            label="Your margin"
            value={usd(economics.netMarginCents)}
            sub={`30% cut, less card fees and ${usd(economics.spendCents)} model spend`}
          />
          <StatTile
            label="Live products"
            value={String(m.publishedCount)}
            sub={m.publishedCount ? `${m.activatedCount} with a sale` : "nothing published yet"}
          />
          <StatTile
            label="Spend"
            value={usd(economics.spendCents)}
            sub={`${usd(m.spendTodayCents)} today · cap $${capUsd}/day`}
            delta={m.hasPrevious ? deltaPct(economics.spendCents, m.prevSpendCents) : null}
            invertDelta
          />
        </div>

        {/* ------------------------------------------------------------- trends */}
        <h2 style={{ marginTop: 40 }}>Momentum</h2>
        <div className="stats">
          <div className="stat">
            <span className="k">New creators</span>
            <div className="v">
              {m.newCreators}
              {m.hasPrevious ? <InlineDelta value={deltaPct(m.newCreators, m.prevNewCreators)} /> : null}
            </div>
            <TrendChart buckets={m.trends.creators} unit="signups" />
          </div>
          <div className="stat">
            <span className="k">Builds started</span>
            <div className="v">
              {m.buildsStarted}
              {m.hasPrevious ? (
                <InlineDelta value={deltaPct(m.buildsStarted, m.prevBuildsStarted)} />
              ) : null}
            </div>
            <TrendChart buckets={m.trends.builds} unit="builds" />
          </div>
          <div className="stat">
            <span className="k">Sales</span>
            <div className="v">{salesInPeriod}</div>
            <TrendChart buckets={m.trends.sales} unit="sales" />
          </div>
        </div>
        <p className="dv-note">Bars are {m.trends.stepLabel}.</p>

        {/* --------------------------------------------------- activation funnel */}
        <h2 style={{ marginTop: 40 }}>Activation funnel</h2>
        <p className="dv-note" style={{ marginTop: 4 }}>
          Creators who signed up in this window. Bar width is share of signups; the second
          number is conversion from the step above. Spec accounts are excluded until handover.
        </p>
        <div className="card" style={{ marginTop: 14 }}>
          <Funnel steps={m.activation} />
        </div>

        {/* ------------------------------------------------------ unit economics */}
        <h2 style={{ marginTop: 40 }}>Unit economics</h2>
        <div className="stats four">
          <StatTile
            label="Cost per build"
            value={economics.costPerBuildCents === null ? "—" : usd(economics.costPerBuildCents)}
            sub={`${economics.buildCount} builds this period`}
          />
          <StatTile
            label="Cost per live product"
            value={
              economics.costPerPublishedCents === null ? "—" : usd(economics.costPerPublishedCents)
            }
            sub="spend ÷ published products"
          />
          <StatTile
            label="Cost per activated"
            value={
              economics.costPerActivatedCents === null ? "—" : usd(economics.costPerActivatedCents)
            }
            sub="spend ÷ creators with a sale"
          />
          <StatTile
            label="Margin per activated"
            value={
              economics.marginPerActivatedCents === null
                ? "—"
                : usd(economics.marginPerActivatedCents)
            }
            sub="your cut, after card fees"
          />
        </div>
        <p className="dv-note">
          Spend includes spec builds nobody claimed — that money was really spent, and leaving
          it out would flatter what a creator costs to acquire.
        </p>

        {/* -------------------------------------------------- days to first sale */}
        <h2 style={{ marginTop: 40 }}>Days to first sale</h2>
        <p className="dv-note" style={{ marginTop: 4 }}>
          {m.dtfs.medianDays === null
            ? "No creator has sold yet."
            : `Median ${m.dtfs.medianDays.toFixed(1)} days from going live to first sale.`}
        </p>
        <div className="card" style={{ marginTop: 14 }}>
          <Histogram buckets={m.dtfs.buckets} unit="live creators" />
        </div>

        {/* --------------------------------------------------------- buyer funnel */}
        <h2 style={{ marginTop: 40 }}>Buyer funnel</h2>
        <div className="card" style={{ marginTop: 14 }}>
          <Funnel steps={m.quiz} />
        </div>

        {/* ------------------------------------------------------- best creators */}
        <h2 style={{ marginTop: 40 }}>Creators</h2>
        <p className="dv-note" style={{ marginTop: 4 }}>
          Lifetime numbers for every live product, best first.
        </p>
        <div className="card" style={{ marginTop: 14 }}>
          {liveRows.length === 0 ? (
            <p className="dv-empty">No published products yet.</p>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Creator</th>
                  <th>Days live</th>
                  <th>Visits</th>
                  <th>Quiz starts</th>
                  <th>Sold</th>
                  <th>Revenue</th>
                  <th>Days to 1st sale</th>
                </tr>
              </thead>
              <tbody>
                {liveRows.map((r) => (
                  <tr key={r.id}>
                    <td>@{r.handle}</td>
                    <td className="mono">{days(r.daysLive)}</td>
                    <td className="mono">{r.visits}</td>
                    <td className="mono">{r.quizStarts}</td>
                    <td className="mono">{r.sold}</td>
                    <td className="mono">{r.revenueCents ? usd(r.revenueCents) : "—"}</td>
                    <td className="mono">{days(r.daysToFirstSale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* --------------------------------------------------- per-creator funnel */}
        <h2 style={{ marginTop: 40 }}>Funnel per creator</h2>
        <div className="card" style={{ marginTop: 14 }}>
          {liveRows.length === 0 ? (
            <p className="dv-empty">Nothing live to break down.</p>
          ) : (
            liveRows.map((r) => (
              <CreatorStrip
                key={r.id}
                handle={r.handle}
                segments={[
                  { label: "visits", value: r.visits },
                  { label: "quiz", value: r.quizStarts },
                  { label: "finished", value: r.quizFinished },
                  { label: "checkout", value: r.checkouts },
                  { label: "sold", value: r.sold },
                ]}
              />
            ))
          )}
        </div>

        {/* --------------------------------------------------------------- builds */}
        <h2 style={{ marginTop: 40 }}>Builds</h2>
        <div className="card" style={{ marginTop: 14 }}>
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
              {m.builds.map((b) => (
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
