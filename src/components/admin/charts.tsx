import Link from "next/link";
import type { Bucket, FunnelStep, HistBucket } from "@/lib/metrics";

/**
 * Presentation primitives for the admin dashboard.
 *
 * All CSS grid and divs, no SVG: it matches the existing .progress-bar and
 * .score vocabulary, stays responsive without viewBox arithmetic, and keeps
 * every label in real text that a screen reader and a browser's find-in-page
 * can both reach.
 */

// ---------------------------------------------------------------- stat tile

export function Delta({ value, invert = false }: { value: number | null; invert?: boolean }) {
  // No previous period, or it was zero — "up from nothing" is not a percentage.
  if (value === null) return null;
  if (value === 0) return <span className="dv-delta flat">±0%</span>;
  const good = invert ? value < 0 : value > 0;
  return (
    <span className={`dv-delta ${good ? "up" : "down"}`}>
      {value > 0 ? "↑" : "↓"}
      {Math.abs(value)}%
    </span>
  );
}

export function StatTile({
  label,
  value,
  sub,
  delta,
  /** true where a rise is bad — spend, cost per build. */
  invertDelta = false,
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
  delta?: number | null;
  invertDelta?: boolean;
}) {
  return (
    <div className="stat">
      <span className="k">{label}</span>
      <div className="v">{value}</div>
      <div className="sub">
        {sub}
        {delta !== undefined && delta !== null ? (
          <>
            {sub ? " · " : null}
            <Delta value={delta} invert={invertDelta} />
          </>
        ) : null}
      </div>
    </div>
  );
}

// ------------------------------------------------------------- range picker

export function RangeTabs({
  ranges,
  active,
}: {
  ranges: readonly { key: string; label: string }[];
  active: string;
}) {
  return (
    <div className="dv-tabs">
      {ranges.map((r) => (
        <Link
          key={r.key}
          href={`/admin?d=${r.key}`}
          className={`lk-tab${r.key === active ? " on" : ""}`}
          aria-current={r.key === active ? "page" : undefined}
        >
          {r.label}
        </Link>
      ))}
    </div>
  );
}

// ------------------------------------------------------------ column charts

/** Sparkline-style activity bars. One column per time bucket. */
export function TrendChart({ buckets, unit }: { buckets: Bucket[]; unit: string }) {
  if (!buckets.length) return <p className="dv-empty">No range to plot.</p>;
  const max = Math.max(1, ...buckets.map((b) => b.value));
  const total = buckets.reduce((t, b) => t + b.value, 0);
  return (
    <div className="dv-chart">
      <div
        className="dv-cols"
        role="img"
        aria-label={`${total} ${unit} over ${buckets.length} periods, peak ${max}`}
      >
        {buckets.map((b) => (
          <div
            key={b.start}
            className={b.value ? "dv-colbar" : "dv-colbar zero"}
            style={{ height: b.value ? `${Math.max(5, (b.value / max) * 100)}%` : "2px" }}
            title={`${b.label}: ${b.value}`}
          />
        ))}
      </div>
      <div className="dv-axis">
        <span>{buckets[0].label}</span>
        <span>{buckets[buckets.length - 1].label}</span>
      </div>
    </div>
  );
}

/** Labelled histogram — each column carries its own count and caption. */
export function Histogram({ buckets, unit }: { buckets: HistBucket[]; unit: string }) {
  const max = Math.max(1, ...buckets.map((b) => b.value));
  const total = buckets.reduce((t, b) => t + b.value, 0);
  if (!total) return <p className="dv-empty">Nothing to plot yet.</p>;
  return (
    <div className="dv-chart">
      <div className="dv-cols tall" role="img" aria-label={`Distribution of ${total} ${unit}`}>
        {buckets.map((b) => (
          <div
            key={b.label}
            className={b.value ? "dv-colbar" : "dv-colbar zero"}
            style={{ height: b.value ? `${Math.max(5, (b.value / max) * 100)}%` : "2px" }}
            title={`${b.label}: ${b.value}`}
          />
        ))}
      </div>
      <div className="dv-ticks">
        {buckets.map((b) => (
          <span key={b.label} className="dv-tick">
            <b>{b.value}</b>
            {b.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ funnels

/**
 * Horizontal funnel. Bar width is share of the top step, so the shape of the
 * drop-off is visible at a glance; the numbers to the right give the exact
 * step-to-step conversion, which is the part you act on.
 */
export function Funnel({ steps }: { steps: FunnelStep[] }) {
  if (!steps.length || steps[0].value === 0) {
    return <p className="dv-empty">No one has entered this funnel yet.</p>;
  }
  return (
    <div className="dv-funnel">
      {steps.map((s) => (
        <div key={s.label} className="dv-step">
          <span className="dv-step-label">{s.label}</span>
          <div className="dv-track">
            <div className="dv-fill" style={{ width: `${Math.max(s.ofTop, 0)}%` }} />
          </div>
          <span className="dv-step-val">
            {s.value}
            {s.ofPrev === null ? null : <i> · {s.ofPrev}%</i>}
          </span>
        </div>
      ))}
    </div>
  );
}

/** One creator's buyer funnel, compact enough to scan a column of them. */
export function CreatorStrip({
  handle,
  segments,
}: {
  handle: string;
  segments: { label: string; value: number }[];
}) {
  const max = Math.max(1, ...segments.map((s) => s.value));
  return (
    <div className="dv-strip">
      <span>@{handle}</span>
      <div className="dv-segs">
        {segments.map((s) => (
          <div key={s.label}>
            <div className="dv-seg-track" title={`${s.label}: ${s.value}`}>
              <div
                className="dv-seg-fill"
                style={{ height: s.value ? `${Math.max(12, (s.value / max) * 100)}%` : "2px" }}
              />
            </div>
            <div className="dv-seg-v">{s.value}</div>
            <div className="dv-seg-k">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
