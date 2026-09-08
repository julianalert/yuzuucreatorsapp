/**
 * Pure metric math for the founder dashboard. No database, no server-only —
 * everything here takes rows and returns numbers, so it can be unit-tested.
 *
 * That matters more than usual: a wrong funnel doesn't throw, it just quietly
 * reports a number the founder then makes decisions on.
 */

export const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * An order's status advances past "paid" as the plan generates and delivers,
 * so filtering on "paid" alone undercounts real sales. This is the convention
 * already used across the dashboard and creator pages.
 */
export const REAL_SALE_STATUSES = ["paid", "generating", "delivered"] as const;

/**
 * Money floor for a sale to count. Early test orders were priced at $1, and
 * counting them makes revenue and every ratio derived from it meaningless.
 * They still appear in the builds/orders tables — they just don't move money
 * metrics.
 */
export const MIN_REAL_ORDER_CENTS = 500;

// --------------------------------------------------------------- formatting

/** Cents → "$1,234" / "$12.34". Two decimals only where they carry meaning. */
export function usd(cents: number): string {
  const v = cents / 100;
  const abs = Math.abs(v);
  const digits = abs < 100 && abs !== 0 ? 2 : 0;
  const body = abs.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return `${v < 0 ? "−" : ""}$${body}`;
}

/** Whole-percent share, 0 when there is nothing to divide by. */
export function pct(n: number, of: number): number {
  if (!of) return 0;
  return Math.round((n / of) * 100);
}

/**
 * Period-over-period change. Null when the previous period was zero — "up from
 * nothing" is not a percentage, and rendering ∞ or +100% would be a lie.
 */
export function deltaPct(current: number, previous: number): number | null {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * DAY_MS).toISOString();
}

// ------------------------------------------------------------- time buckets

export interface Bucket {
  /** Bucket start, ms since epoch. */
  start: number;
  /** Short axis label, e.g. "9/3". */
  label: string;
  value: number;
}

function shortDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/**
 * Count timestamps into fixed-width buckets spanning [fromMs, toMs].
 *
 * Buckets are built from `toMs` backwards so the final bucket always ends
 * "now" — otherwise the most recent bar is a partial period and reads as a
 * cliff, which is the single most common way a trend chart misleads.
 */
export function bucketCounts(
  isoDates: (string | null | undefined)[],
  fromMs: number,
  toMs: number,
  stepMs: number
): Bucket[] {
  if (stepMs <= 0 || toMs <= fromMs) return [];
  const count = Math.max(1, Math.ceil((toMs - fromMs) / stepMs));
  const buckets: Bucket[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const start = toMs - (i + 1) * stepMs;
    buckets.push({ start, label: shortDate(start), value: 0 });
  }
  const first = buckets[0].start;
  for (const iso of isoDates) {
    if (!iso) continue;
    const t = new Date(iso).getTime();
    if (Number.isNaN(t) || t < first || t > toMs) continue;
    const idx = Math.min(buckets.length - 1, Math.floor((t - first) / stepMs));
    buckets[idx].value++;
  }
  return buckets;
}

// ------------------------------------------------------------------ funnels

export interface FunnelStep {
  label: string;
  value: number;
  /** Share of the step above, in percent. Null on the first step. */
  ofPrev: number | null;
  /** Share of the top of the funnel, in percent. */
  ofTop: number;
}

/** Turn raw counts into a funnel with both conversion rates worked out. */
export function funnelSteps(steps: { label: string; value: number }[]): FunnelStep[] {
  const top = steps[0]?.value ?? 0;
  return steps.map((s, i) => ({
    label: s.label,
    value: s.value,
    ofPrev: i === 0 ? null : pct(s.value, steps[i - 1].value),
    ofTop: pct(s.value, top),
  }));
}

export interface ActivationInput {
  /** Real creators only — spec accounts are excluded before this is called. */
  creatorIds: string[];
  withBuild: Set<string>;
  reachedReview: Set<string>;
  published: Set<string>;
  withVisit: Set<string>;
  withQuiz: Set<string>;
  withSale: Set<string>;
}

/**
 * The creator journey, signup to first sale. This is the "where do creators
 * fall out" answer: building is cheap, getting someone to actually launch and
 * sell is where the drop happens.
 */
export function activationFunnel(i: ActivationInput): FunnelStep[] {
  const inSet = (s: Set<string>) => i.creatorIds.filter((id) => s.has(id)).length;
  return funnelSteps([
    { label: "Signed up", value: i.creatorIds.length },
    { label: "Started a build", value: inSet(i.withBuild) },
    { label: "Reached review", value: inSet(i.reachedReview) },
    { label: "Published", value: inSet(i.published) },
    { label: "First visitor", value: inSet(i.withVisit) },
    { label: "First quiz", value: inSet(i.withQuiz) },
    { label: "First sale", value: inSet(i.withSale) },
  ]);
}

/**
 * quiz_sessions.status is a furthest-reached marker, not a state the row
 * passes through and leaves. So a session sitting at "checkout" also reached
 * "quiz_completed", and counting `where status = 'quiz_completed'` badly
 * undercounts. Rank and count everything at or above each rung.
 */
export const QUIZ_RANK: Record<string, number> = {
  quiz_started: 0,
  quiz_completed: 1,
  checkout: 2,
  paid: 3,
};

export function quizFunnel(sessions: { status: string }[]): FunnelStep[] {
  const reached = (rank: number) =>
    sessions.filter((s) => (QUIZ_RANK[s.status] ?? 0) >= rank).length;
  return funnelSteps([
    { label: "Started the quiz", value: sessions.length },
    { label: "Finished it", value: reached(1) },
    { label: "Reached checkout", value: reached(2) },
    { label: "Paid", value: reached(3) },
  ]);
}

// ------------------------------------------------------- days to first sale

export interface HistBucket {
  label: string;
  value: number;
}

const DTFS_EDGES: { label: string; max: number }[] = [
  { label: "<1d", max: 1 },
  { label: "1–3d", max: 3 },
  { label: "3–7d", max: 7 },
  { label: "7–14d", max: 14 },
  { label: "14d+", max: Infinity },
];

/**
 * Distribution rather than an average. With a handful of creators the spread
 * is the signal — one creator selling in six hours and one taking three weeks
 * average out to something that describes neither.
 *
 * `null` entries are creators who are live but haven't sold yet; they get
 * their own bucket so the denominator stays honest.
 */
export function daysToFirstSaleBuckets(days: (number | null)[]): HistBucket[] {
  const out: HistBucket[] = DTFS_EDGES.map((e) => ({ label: e.label, value: 0 }));
  let notYet = 0;
  for (const d of days) {
    if (d === null || Number.isNaN(d)) {
      notYet++;
      continue;
    }
    const idx = DTFS_EDGES.findIndex((e) => d < e.max);
    out[idx === -1 ? out.length - 1 : idx].value++;
  }
  out.push({ label: "not yet", value: notYet });
  return out;
}

export function median(nums: number[]): number | null {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// ------------------------------------------------------------------- money

export interface OrderLike {
  status: string;
  amount_cents: number;
  net_cents: number | null;
  platform_cents: number | null;
  creator_cents: number | null;
  stripe_fee_cents: number | null;
  created_at: string;
}

/**
 * The sale actually completed. Used for *activation* — whether the machine
 * worked for this creator — where a $1 test still proves a buyer went all the
 * way through quiz, checkout and delivery.
 */
export function isCompletedSale(o: Pick<OrderLike, "status">): boolean {
  return (REAL_SALE_STATUSES as readonly string[]).includes(o.status);
}

/**
 * The sale is also worth counting as money. Used for revenue, margin and
 * average order value, where a $1 test order would drag every figure to
 * nonsense. Deliberately narrower than isCompletedSale().
 */
export function isRealSale(o: Pick<OrderLike, "status" | "amount_cents">): boolean {
  return isCompletedSale(o) && o.amount_cents >= MIN_REAL_ORDER_CENTS;
}

export interface RevenueSummary {
  count: number;
  /** List price before tax — what the split is calculated on. */
  netCents: number;
  /** Yuzuu's 30% before card fees. */
  platformCents: number;
  creatorCents: number;
  /** Stripe fees, which come out of Yuzuu's side. Null until the webhook fires. */
  feeCents: number;
  avgOrderCents: number;
}

export function revenueSummary(orders: OrderLike[]): RevenueSummary {
  const real = orders.filter(isRealSale);
  const sum = (f: (o: OrderLike) => number | null) =>
    real.reduce((t, o) => t + (f(o) ?? 0), 0);
  const netCents = sum((o) => o.net_cents ?? o.amount_cents);
  return {
    count: real.length,
    netCents,
    platformCents: sum((o) => o.platform_cents),
    creatorCents: sum((o) => o.creator_cents),
    feeCents: sum((o) => o.stripe_fee_cents),
    avgOrderCents: real.length ? Math.round(netCents / real.length) : 0,
  };
}

export interface UnitEconomicsInput {
  /** Every build in the period, spec ones included — that money was spent. */
  buildCostsUsd: number[];
  publishedCount: number;
  activatedCount: number;
  revenue: RevenueSummary;
}

export interface UnitEconomics {
  buildCount: number;
  spendCents: number;
  costPerBuildCents: number | null;
  costPerPublishedCents: number | null;
  /** The honest CAC: total spend over creators who actually sold. */
  costPerActivatedCents: number | null;
  marginPerActivatedCents: number | null;
  /** What Yuzuu keeps after card fees and model spend. Negative pre-PMF. */
  netMarginCents: number;
}

export function unitEconomics(i: UnitEconomicsInput): UnitEconomics {
  const spendCents = Math.round(i.buildCostsUsd.reduce((t, c) => t + (c || 0), 0) * 100);
  const per = (n: number) => (n > 0 ? Math.round(spendCents / n) : null);
  const grossMargin = i.revenue.platformCents - i.revenue.feeCents;
  return {
    buildCount: i.buildCostsUsd.length,
    spendCents,
    costPerBuildCents: per(i.buildCostsUsd.length),
    costPerPublishedCents: per(i.publishedCount),
    costPerActivatedCents: per(i.activatedCount),
    marginPerActivatedCents: i.activatedCount
      ? Math.round(grossMargin / i.activatedCount)
      : null,
    netMarginCents: grossMargin - spendCents,
  };
}
