import "server-only";
import Stripe from "stripe";

/**
 * Yuzuu is merchant of record on a plain Stripe account — no Connect.
 * Buyers pay Yuzuu; creators are paid monthly from the ledger (src/lib/ledger.ts).
 * See docs/payments.md.
 */

let _stripe: Stripe | null = null;

export function stripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not set");
  _stripe = new Stripe(key);
  return _stripe;
}

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}
