import "server-only";
import { supabaseAdmin } from "./supabase/admin";
import type { BuildRow } from "./db/types";
import {
  DAY_MS,
  activationFunnel,
  bucketCounts,
  daysToFirstSaleBuckets,
  isCompletedSale,
  isRealSale,
  median,
  quizFunnel,
  revenueSummary,
  unitEconomics,
  type Bucket,
  type FunnelStep,
  type HistBucket,
  type OrderLike,
  type RevenueSummary,
  type UnitEconomics,
} from "./metrics";

export const RANGES = [
  { key: "7", days: 7, label: "7d" },
  { key: "30", days: 30, label: "30d" },
  { key: "90", days: 90, label: "90d" },
  { key: "all", days: null, label: "All" },
] as const;

export type RangeKey = (typeof RANGES)[number]["key"];

export function resolveRange(raw: string | undefined): (typeof RANGES)[number] {
  return RANGES.find((r) => r.key === raw) ?? RANGES[1];
}

export interface CreatorMetricRow {
  id: string;
  handle: string;
  isSpec: boolean;
  /** Null until the product is published. */
  daysLive: number | null;
  visits: number;
  quizStarts: number;
  quizFinished: number;
  checkouts: number;
  sold: number;
  revenueCents: number;
  daysToFirstSale: number | null;
}

export type BuildTableRow = BuildRow & {
  creators: { handle: string | null; email: string } | null;
};

export interface Dashboard {
  range: (typeof RANGES)[number];
  /** Null when the range is "all" — there is no comparable earlier window. */
  hasPrevious: boolean;

  revenue: RevenueSummary;
  prevRevenue: RevenueSummary;
  economics: UnitEconomics;

  newCreators: number;
  prevNewCreators: number;
  buildsStarted: number;
  prevBuildsStarted: number;
  publishedCount: number;
  activatedCount: number;

  spendTodayCents: number;
  prevSpendCents: number;

  trends: { creators: Bucket[]; builds: Bucket[]; sales: Bucket[]; stepLabel: string };
  activation: FunnelStep[];
  quiz: FunnelStep[];
  dtfs: { buckets: HistBucket[]; medianDays: number | null };

  creatorRows: CreatorMetricRow[];
  builds: BuildTableRow[];
}

interface CreatorLite {
  id: string;
  handle: string | null;
  created_at: string;
  is_spec: boolean;
}
interface BlueprintLite {
  id: string;
  creator_id: string;
  published: boolean;
  approved_at: string | null;
  created_at: string;
}
interface SessionLite {
  creator_id: string;
  status: string;
  created_at: string;
}
interface EventLite {
  creator_id: string;
  type: string;
  created_at: string;
}
type OrderLiteRow = OrderLike & { blueprint_id: string };

const within = (iso: string | null, from: number, to: number) => {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= from && t <= to;
};

/**
 * One batched read of everything the dashboard needs, then all grouping in JS.
 *
 * The previous implementation fired three `count: exact` queries per published
 * creator; at the fifty creators the spec-build push is about to add that is
 * 150+ round trips for one page load. This is six queries regardless of scale.
 *
 * That holds until `creator_events` gets large — every page visit is a row.
 * Past roughly 10k events the right answer is a Postgres RPC returning
 * per-creator aggregates rather than shipping the rows here.
 */
export async function loadDashboard(rangeKey: string | undefined): Promise<Dashboard> {
  const range = resolveRange(rangeKey);
  const db = supabaseAdmin();

  const [creatorsQ, buildsQ, blueprintsQ, ordersQ, sessionsQ, eventsQ] = await Promise.all([
    db.from("creators").select("id, handle, created_at, is_spec"),
    db.from("builds").select("*, creators(handle, email)").order("created_at", { ascending: false }),
    db.from("blueprints").select("id, creator_id, published, approved_at, created_at"),
    db
      .from("orders")
      .select(
        "blueprint_id, status, amount_cents, net_cents, platform_cents, creator_cents, stripe_fee_cents, created_at"
      ),
    db.from("quiz_sessions").select("creator_id, status, created_at"),
    db.from("creator_events").select("creator_id, type, created_at"),
  ]);

  const allCreators = (creatorsQ.data ?? []) as CreatorLite[];
  const allBuilds = (buildsQ.data ?? []) as BuildTableRow[];
  const blueprints = (blueprintsQ.data ?? []) as BlueprintLite[];
  const orders = (ordersQ.data ?? []) as OrderLiteRow[];
  const sessions = (sessionsQ.data ?? []) as SessionLite[];
  const events = (eventsQ.data ?? []) as EventLite[];

  // Spec accounts have no real owner, so they are not creators for any
  // funnel or activation purpose. Handover clears is_spec, which is exactly
  // when they should start counting — no special case needed.
  const creators = allCreators.filter((c) => !c.is_spec);
  const realIds = new Set(creators.map((c) => c.id));

  const now = Date.now();
  const earliest = allCreators.reduce(
    (min, c) => Math.min(min, new Date(c.created_at).getTime()),
    now
  );
  const fromMs = range.days ? now - range.days * DAY_MS : earliest;
  const span = Math.max(DAY_MS, now - fromMs);
  const prevFrom = fromMs - span;

  // ---- attribution maps ----------------------------------------------------
  const bpCreator = new Map(blueprints.map((b) => [b.id, b.creator_id]));
  const ordersByCreator = new Map<string, OrderLiteRow[]>();
  for (const o of orders) {
    const cid = bpCreator.get(o.blueprint_id);
    if (!cid) continue;
    const list = ordersByCreator.get(cid);
    if (list) list.push(o);
    else ordersByCreator.set(cid, [o]);
  }

  const realCreatorOrders = orders.filter((o) => {
    const cid = bpCreator.get(o.blueprint_id);
    return cid ? realIds.has(cid) : false;
  });

  // ---- membership sets for the activation funnel ---------------------------
  const setOf = <T>(rows: T[], key: (r: T) => string | null | undefined) => {
    const s = new Set<string>();
    for (const r of rows) {
      const k = key(r);
      if (k && realIds.has(k)) s.add(k);
    }
    return s;
  };

  const withBuild = setOf(allBuilds, (b) => b.creator_id);
  // a blueprint row is written at persist-blueprint, immediately before the
  // build parks on awaiting_approval — so having one *is* reaching review
  const reachedReview = setOf(blueprints, (b) => b.creator_id);
  const publishedSet = setOf(
    blueprints.filter((b) => b.published),
    (b) => b.creator_id
  );
  const withVisit = setOf(
    events.filter((e) => e.type === "page_visit"),
    (e) => e.creator_id
  );
  const withQuiz = setOf(sessions, (s) => s.creator_id);
  const withSale = setOf(
    realCreatorOrders.filter(isCompletedSale),
    (o) => bpCreator.get(o.blueprint_id)
  );

  // ---- period slices -------------------------------------------------------
  const inPeriod = <T>(rows: T[], key: (r: T) => string | null) =>
    rows.filter((r) => within(key(r), fromMs, now));
  const inPrev = <T>(rows: T[], key: (r: T) => string | null) =>
    rows.filter((r) => within(key(r), prevFrom, fromMs));

  const periodOrders = inPeriod(realCreatorOrders, (o) => o.created_at);
  const revenue = revenueSummary(periodOrders);
  const prevRevenue = revenueSummary(inPrev(realCreatorOrders, (o) => o.created_at));

  // Spend counts every build, spec ones included — that money was really
  // burned, and hiding it would flatter cost-per-activated-creator.
  const periodBuilds = inPeriod(allBuilds, (b) => b.created_at);
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);

  const economics = unitEconomics({
    buildCostsUsd: periodBuilds.map((b) => b.cost_usd ?? 0),
    publishedCount: publishedSet.size,
    activatedCount: withSale.size,
    revenue,
  });

  // ---- per-creator rows (lifetime, not period-scoped) ----------------------
  const publishedByCreator = new Map<string, BlueprintLite>();
  for (const b of blueprints) {
    if (b.published) publishedByCreator.set(b.creator_id, b);
  }

  const countBy = (pred: (s: SessionLite) => boolean) => {
    const m = new Map<string, number>();
    for (const s of sessions) {
      if (!pred(s)) continue;
      m.set(s.creator_id, (m.get(s.creator_id) ?? 0) + 1);
    }
    return m;
  };
  const quizStarts = countBy(() => true);
  const quizFinished = countBy((s) => s.status !== "quiz_started");
  const checkouts = countBy((s) => s.status === "checkout" || s.status === "paid");

  const visitsByCreator = new Map<string, number>();
  for (const e of events) {
    if (e.type !== "page_visit") continue;
    visitsByCreator.set(e.creator_id, (visitsByCreator.get(e.creator_id) ?? 0) + 1);
  }

  const creatorRows: CreatorMetricRow[] = creators.map((c) => {
    const live = publishedByCreator.get(c.id);
    const liveAt = live ? new Date(live.approved_at ?? live.created_at).getTime() : null;
    const mine = ordersByCreator.get(c.id) ?? [];
    const completed = mine.filter(isCompletedSale);
    const firstSaleAt = completed.length
      ? Math.min(...completed.map((o) => new Date(o.created_at).getTime()))
      : null;

    return {
      id: c.id,
      handle: c.handle ?? "—",
      isSpec: c.is_spec,
      daysLive: liveAt === null ? null : (now - liveAt) / DAY_MS,
      visits: visitsByCreator.get(c.id) ?? 0,
      quizStarts: quizStarts.get(c.id) ?? 0,
      quizFinished: quizFinished.get(c.id) ?? 0,
      checkouts: checkouts.get(c.id) ?? 0,
      sold: completed.length,
      // money keeps the $5 floor even though `sold` above does not: one is
      // "did it work", the other is "what did it earn"
      revenueCents: mine.filter(isRealSale).reduce((t, o) => t + (o.net_cents ?? o.amount_cents), 0),
      daysToFirstSale:
        liveAt !== null && firstSaleAt !== null ? (firstSaleAt - liveAt) / DAY_MS : null,
    };
  });

  const liveRows = creatorRows.filter((r) => r.daysLive !== null);
  const dtfsDays = liveRows.map((r) => r.daysToFirstSale);

  // ---- trends --------------------------------------------------------------
  const stepMs = span > 45 * DAY_MS ? 7 * DAY_MS : DAY_MS;
  const cohortCreators = inPeriod(creators, (c) => c.created_at);

  return {
    range,
    hasPrevious: range.days !== null,

    revenue,
    prevRevenue,
    economics,

    newCreators: cohortCreators.length,
    prevNewCreators: inPrev(creators, (c) => c.created_at).length,
    buildsStarted: periodBuilds.length,
    prevBuildsStarted: inPrev(allBuilds, (b) => b.created_at).length,
    publishedCount: publishedSet.size,
    activatedCount: withSale.size,

    spendTodayCents: Math.round(
      allBuilds
        .filter((b) => new Date(b.created_at) >= midnight)
        .reduce((t, b) => t + (b.cost_usd ?? 0), 0) * 100
    ),
    prevSpendCents: Math.round(
      inPrev(allBuilds, (b) => b.created_at).reduce((t, b) => t + (b.cost_usd ?? 0), 0) * 100
    ),

    trends: {
      creators: bucketCounts(
        creators.map((c) => c.created_at),
        fromMs,
        now,
        stepMs
      ),
      builds: bucketCounts(
        allBuilds.map((b) => b.created_at),
        fromMs,
        now,
        stepMs
      ),
      sales: bucketCounts(
        realCreatorOrders.filter(isCompletedSale).map((o) => o.created_at),
        fromMs,
        now,
        stepMs
      ),
      stepLabel: stepMs === DAY_MS ? "per day" : "per week",
    },

    // the funnel is a cohort: creators who signed up inside the window
    activation: activationFunnel({
      creatorIds: cohortCreators.map((c) => c.id),
      withBuild,
      reachedReview,
      published: publishedSet,
      withVisit,
      withQuiz,
      withSale,
    }),

    quiz: quizFunnel(inPeriod(sessions, (s) => s.created_at)),

    dtfs: {
      buckets: daysToFirstSaleBuckets(dtfsDays),
      medianDays: median(dtfsDays.filter((d): d is number => d !== null)),
    },

    creatorRows: creatorRows
      .filter((r) => r.daysLive !== null)
      .sort(
        (a, b) => b.revenueCents - a.revenueCents || b.sold - a.sold || b.visits - a.visits
      ),
    builds: allBuilds.slice(0, 50),
  };
}
