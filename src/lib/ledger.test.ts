import { describe, expect, it } from "vitest";
import { balanceFromEntries } from "./ledger";

const DAY = 24 * 3600 * 1000;
const past = new Date(Date.now() - DAY).toISOString();
const future = new Date(Date.now() + 10 * DAY).toISOString();

describe("balanceFromEntries", () => {
  it("is all zeros with no entries", () => {
    expect(balanceFromEntries([])).toEqual({
      availableCents: 0,
      pendingCents: 0,
      paidOutCents: 0,
    });
  });

  it("holds a fresh sale as pending until available_at passes", () => {
    const b = balanceFromEntries([
      { kind: "sale", amount_cents: 1890, available_at: future, payout_id: null },
    ]);
    expect(b.pendingCents).toBe(1890);
    expect(b.availableCents).toBe(0);
  });

  it("moves a matured sale to available", () => {
    const b = balanceFromEntries([
      { kind: "sale", amount_cents: 1890, available_at: past, payout_id: null },
    ]);
    expect(b.availableCents).toBe(1890);
    expect(b.pendingCents).toBe(0);
  });

  it("nets refunds against available immediately, even for a pending sale", () => {
    const b = balanceFromEntries([
      { kind: "sale", amount_cents: 1890, available_at: future, payout_id: null },
      { kind: "refund", amount_cents: -1890, available_at: null, payout_id: null },
    ]);
    expect(b.pendingCents).toBe(1890);
    expect(b.availableCents).toBe(-1890);
    expect(b.pendingCents + b.availableCents).toBe(0);
  });

  it("excludes entries stamped into a payout and counts the payout as paid out", () => {
    const b = balanceFromEntries([
      // three matured sales, two paid out in a confirmed run
      { kind: "sale", amount_cents: 1890, available_at: past, payout_id: "p1" },
      { kind: "sale", amount_cents: 1890, available_at: past, payout_id: "p1" },
      { kind: "sale", amount_cents: 1890, available_at: past, payout_id: null },
      { kind: "payout", amount_cents: -3780, available_at: null, payout_id: "p1" },
    ]);
    expect(b.availableCents).toBe(1890);
    expect(b.paidOutCents).toBe(3780);
    expect(b.pendingCents).toBe(0);
  });

  it("carries a post-payout refund as negative available (rides into next run)", () => {
    const b = balanceFromEntries([
      { kind: "sale", amount_cents: 1890, available_at: past, payout_id: "p1" },
      { kind: "payout", amount_cents: -1890, available_at: null, payout_id: "p1" },
      { kind: "refund", amount_cents: -1890, available_at: null, payout_id: null },
    ]);
    expect(b.availableCents).toBe(-1890);
    expect(b.paidOutCents).toBe(1890);
  });
});
