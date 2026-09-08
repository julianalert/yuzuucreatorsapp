import { describe, expect, it } from "vitest";
import {
  DAY_MS,
  activationFunnel,
  bucketCounts,
  daysToFirstSaleBuckets,
  deltaPct,
  funnelSteps,
  isCompletedSale,
  isRealSale,
  median,
  pct,
  quizFunnel,
  revenueSummary,
  unitEconomics,
  usd,
  type OrderLike,
} from "./metrics";

describe("usd", () => {
  it("shows cents below $100 and whole dollars above", () => {
    expect(usd(1234)).toBe("$12.34");
    expect(usd(1_234_500)).toBe("$12,345");
  });

  it("has no decimals on zero", () => {
    expect(usd(0)).toBe("$0");
  });

  it("marks negatives, which is the normal pre-PMF margin", () => {
    expect(usd(-342)).toBe("−$3.42");
  });
});

describe("pct / deltaPct", () => {
  it("is zero rather than NaN when there is nothing to divide by", () => {
    expect(pct(0, 0)).toBe(0);
    expect(pct(5, 0)).toBe(0);
  });

  it("returns null for growth from zero instead of claiming a percentage", () => {
    expect(deltaPct(10, 0)).toBeNull();
  });

  it("reports rise and fall", () => {
    expect(deltaPct(15, 10)).toBe(50);
    expect(deltaPct(5, 10)).toBe(-50);
  });
});

describe("bucketCounts", () => {
  const to = Date.UTC(2026, 8, 8, 12, 0, 0);
  const from = to - 7 * DAY_MS;

  it("returns one bucket per step, ending now", () => {
    const b = bucketCounts([], from, to, DAY_MS);
    expect(b).toHaveLength(7);
    expect(b[6].start + DAY_MS).toBe(to);
  });

  it("counts a timestamp into the bucket containing it", () => {
    const b = bucketCounts([new Date(to - 1000).toISOString()], from, to, DAY_MS);
    expect(b[6].value).toBe(1);
    expect(b.slice(0, 6).every((x) => x.value === 0)).toBe(true);
  });

  it("ignores timestamps outside the window", () => {
    const b = bucketCounts(
      [new Date(from - 5 * DAY_MS).toISOString(), new Date(to + DAY_MS).toISOString()],
      from,
      to,
      DAY_MS
    );
    expect(b.reduce((t, x) => t + x.value, 0)).toBe(0);
  });

  it("survives nulls and unparseable dates", () => {
    const b = bucketCounts([null, undefined, "not-a-date"], from, to, DAY_MS);
    expect(b.reduce((t, x) => t + x.value, 0)).toBe(0);
  });

  it("returns nothing for an inverted range", () => {
    expect(bucketCounts([], to, from, DAY_MS)).toEqual([]);
  });
});

describe("funnelSteps", () => {
  it("works out both conversion rates", () => {
    const f = funnelSteps([
      { label: "a", value: 100 },
      { label: "b", value: 50 },
      { label: "c", value: 25 },
    ]);
    expect(f[0].ofPrev).toBeNull();
    expect(f[0].ofTop).toBe(100);
    expect(f[1].ofPrev).toBe(50);
    expect(f[2].ofPrev).toBe(50);
    expect(f[2].ofTop).toBe(25);
  });

  it("does not divide by zero on an empty funnel", () => {
    const f = funnelSteps([
      { label: "a", value: 0 },
      { label: "b", value: 0 },
    ]);
    expect(f[1].ofPrev).toBe(0);
    expect(f[1].ofTop).toBe(0);
  });
});

describe("quizFunnel", () => {
  /**
   * The rank ladder is the whole point: status marks the furthest rung
   * reached, so a session at "paid" also counts as started and finished.
   */
  it("counts a session at every rung it passed through", () => {
    const f = quizFunnel([{ status: "paid" }]);
    expect(f.map((s) => s.value)).toEqual([1, 1, 1, 1]);
  });

  it("does not credit a started session with finishing", () => {
    const f = quizFunnel([{ status: "quiz_started" }]);
    expect(f.map((s) => s.value)).toEqual([1, 0, 0, 0]);
  });

  it("matches the live shape: 2 started, 3 checkout, 1 paid", () => {
    const f = quizFunnel([
      { status: "quiz_started" },
      { status: "quiz_started" },
      { status: "checkout" },
      { status: "checkout" },
      { status: "checkout" },
      { status: "paid" },
    ]);
    // started 6, finished 4 (3 checkout + 1 paid), checkout 4, paid 1
    expect(f.map((s) => s.value)).toEqual([6, 4, 4, 1]);
  });

  it("treats an unknown status as the bottom rung rather than crashing", () => {
    const f = quizFunnel([{ status: "something_new" }]);
    expect(f.map((s) => s.value)).toEqual([1, 0, 0, 0]);
  });
});

describe("activationFunnel", () => {
  it("only counts creators present in the passed-in id list", () => {
    // "ghost" is a spec creator filtered out upstream; its membership in the
    // sets must not leak into the counts.
    const f = activationFunnel({
      creatorIds: ["a", "b"],
      withBuild: new Set(["a", "b", "ghost"]),
      reachedReview: new Set(["a", "ghost"]),
      published: new Set(["a"]),
      withVisit: new Set(["a"]),
      withQuiz: new Set(["a"]),
      withSale: new Set([]),
    });
    expect(f.map((s) => s.value)).toEqual([2, 2, 1, 1, 1, 1, 0]);
  });

  it("is all zeros with no creators", () => {
    const empty = new Set<string>();
    const f = activationFunnel({
      creatorIds: [],
      withBuild: empty,
      reachedReview: empty,
      published: empty,
      withVisit: empty,
      withQuiz: empty,
      withSale: empty,
    });
    expect(f.every((s) => s.value === 0 && s.ofTop === 0)).toBe(true);
  });
});

describe("daysToFirstSaleBuckets", () => {
  it("bins on the correct side of each edge", () => {
    const b = daysToFirstSaleBuckets([0.3, 2, 5, 10, 40]);
    expect(b.map((x) => x.value)).toEqual([1, 1, 1, 1, 1, 0]);
  });

  it("gives creators who have not sold their own bucket", () => {
    const b = daysToFirstSaleBuckets([null, null, 0.5]);
    expect(b[0].value).toBe(1);
    expect(b[b.length - 1]).toEqual({ label: "not yet", value: 2 });
  });

  it("puts an exact edge value in the higher bucket", () => {
    // 1.0 is not "<1d"
    expect(daysToFirstSaleBuckets([1]).map((x) => x.value)).toEqual([0, 1, 0, 0, 0, 0]);
  });
});

describe("median", () => {
  it("is null with no data", () => {
    expect(median([])).toBeNull();
  });

  it("averages the middle pair on an even count", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it("does not depend on input order", () => {
    expect(median([9, 1, 5])).toBe(5);
  });
});

function order(over: Partial<OrderLike> = {}): OrderLike {
  return {
    status: "delivered",
    amount_cents: 2700,
    net_cents: 2700,
    platform_cents: 810,
    creator_cents: 1890,
    stripe_fee_cents: 108,
    created_at: "2026-09-01T00:00:00.000Z",
    ...over,
  };
}

describe("isCompletedSale vs isRealSale", () => {
  it("splits on the thing they measure: a $1 test proves the machine worked", () => {
    const test = order({ amount_cents: 100 });
    expect(isCompletedSale(test)).toBe(true); // counts for activation
    expect(isRealSale(test)).toBe(false); // does not count as revenue
  });
});

describe("isRealSale", () => {
  it("accepts every post-payment status, not just paid", () => {
    for (const status of ["paid", "generating", "delivered"]) {
      expect(isRealSale(order({ status }))).toBe(true);
    }
  });

  it("rejects orders that never completed", () => {
    expect(isRealSale(order({ status: "pending_payment" }))).toBe(false);
    expect(isRealSale(order({ status: "refunded" }))).toBe(false);
  });

  it("rejects the $1 test orders", () => {
    expect(isRealSale(order({ amount_cents: 100 }))).toBe(false);
    expect(isRealSale(order({ amount_cents: 499 }))).toBe(false);
    expect(isRealSale(order({ amount_cents: 500 }))).toBe(true);
  });
});

describe("revenueSummary", () => {
  it("is empty, not NaN, when nothing qualifies", () => {
    const r = revenueSummary([order({ amount_cents: 100 }), order({ status: "failed" })]);
    expect(r).toEqual({
      count: 0,
      netCents: 0,
      platformCents: 0,
      creatorCents: 0,
      feeCents: 0,
      avgOrderCents: 0,
    });
  });

  it("sums the split and averages the order value", () => {
    const r = revenueSummary([order(), order()]);
    expect(r.count).toBe(2);
    expect(r.netCents).toBe(5400);
    expect(r.platformCents).toBe(1620);
    expect(r.creatorCents).toBe(3780);
    expect(r.avgOrderCents).toBe(2700);
  });

  it("falls back to amount_cents when the webhook has not filled net_cents", () => {
    const r = revenueSummary([order({ net_cents: null })]);
    expect(r.netCents).toBe(2700);
  });

  it("treats a null stripe fee as zero rather than poisoning the total", () => {
    const r = revenueSummary([order({ stripe_fee_cents: null })]);
    expect(r.feeCents).toBe(0);
    expect(Number.isNaN(r.feeCents)).toBe(false);
  });
});

describe("unitEconomics", () => {
  const noRevenue = revenueSummary([]);

  it("returns nulls instead of dividing by zero on an empty period", () => {
    const u = unitEconomics({
      buildCostsUsd: [],
      publishedCount: 0,
      activatedCount: 0,
      revenue: noRevenue,
    });
    expect(u.costPerBuildCents).toBeNull();
    expect(u.costPerActivatedCents).toBeNull();
    expect(u.marginPerActivatedCents).toBeNull();
    expect(u.netMarginCents).toBe(0);
  });

  it("reports the real pre-PMF picture: spend with nothing earned", () => {
    const u = unitEconomics({
      buildCostsUsd: [0.96, 1.82, 0.59],
      publishedCount: 1,
      activatedCount: 0,
      revenue: noRevenue,
    });
    expect(u.spendCents).toBe(337);
    expect(u.costPerBuildCents).toBe(112);
    expect(u.costPerPublishedCents).toBe(337);
    expect(u.netMarginCents).toBe(-337);
  });

  it("nets card fees and model spend out of the platform cut", () => {
    const u = unitEconomics({
      buildCostsUsd: [2],
      publishedCount: 1,
      activatedCount: 1,
      revenue: revenueSummary([order()]),
    });
    // 810 platform − 108 fees − 200 spend
    expect(u.netMarginCents).toBe(502);
    expect(u.marginPerActivatedCents).toBe(702);
  });
});
