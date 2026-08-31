import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { inngest } from "@/lib/inngest/client";
import { recordSale, recordRefund } from "@/lib/ledger";
import type { OrderRow } from "@/lib/db/types";

/**
 * Stripe webhook: records facts, never pays anyone.
 *
 *   checkout.session.completed → order paid, ledger sale, order/paid event
 *   charge.refunded            → order refunded, ledger refund
 *
 * Every branch is idempotent (status guards, the unique (order_id, kind)
 * ledger index, and Inngest event-id dedupe), so Stripe re-deliveries and
 * mid-handler crashes both resolve to the same end state on retry.
 */

async function creatorIdForOrder(order: Pick<OrderRow, "blueprint_id">): Promise<string | null> {
  const { data } = await supabaseAdmin()
    .from("blueprints")
    .select("creator_id")
    .eq("id", order.blueprint_id)
    .single();
  return (data?.creator_id as string) ?? null;
}

/** The actual processing fee from the balance transaction — never an estimate. */
async function stripeFeeCents(paymentIntentId: string): Promise<number | null> {
  try {
    const pi = await stripe().paymentIntents.retrieve(paymentIntentId, {
      expand: ["latest_charge.balance_transaction"],
    });
    const charge = pi.latest_charge as Stripe.Charge | null;
    const txn = charge?.balance_transaction as Stripe.BalanceTransaction | null;
    return typeof txn?.fee === "number" ? txn.fee : null;
  } catch (e) {
    console.error("[stripe webhook] fee lookup failed (non-fatal):", e);
    return null;
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const orderId = session.metadata?.order_id;
  if (!orderId) return; // not one of ours

  const admin = supabaseAdmin();
  const { data: order } = await admin.from("orders").select("*").eq("id", orderId).single();
  if (!order) {
    console.error(`[stripe webhook] session for unknown order ${orderId}`);
    return;
  }

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;

  // promote pending_payment → paid exactly once; re-deliveries skip this
  if (order.status === "pending_payment") {
    const fee = paymentIntentId ? await stripeFeeCents(paymentIntentId) : null;
    const { error } = await admin
      .from("orders")
      .update({
        status: "paid",
        stripe_payment_intent: paymentIntentId,
        gross_cents: session.amount_total ?? order.net_cents,
        tax_cents: session.total_details?.amount_tax ?? 0,
        stripe_fee_cents: fee,
        buyer_email: session.customer_details?.email ?? order.buyer_email,
      })
      .eq("id", orderId)
      .eq("status", "pending_payment");
    if (error) throw new Error(`order update: ${error.message}`);
  } else if (order.status === "refunded" || order.status === "failed") {
    return; // too late — don't resurrect a dead order
  }

  const creatorId = await creatorIdForOrder(order as OrderRow);
  if (creatorId) await recordSale(order as OrderRow, creatorId);

  // funnel: close the loop on the quiz session (non-fatal)
  const quizSessionId = session.metadata?.quiz_session_id;
  if (quizSessionId) {
    try {
      await admin
        .from("quiz_sessions")
        .update({
          status: "paid",
          order_id: orderId,
          email: session.customer_details?.email ?? order.buyer_email,
          updated_at: new Date().toISOString(),
        })
        .eq("id", quizSessionId)
        .eq("blueprint_id", order.blueprint_id);
    } catch (e) {
      console.error("[stripe webhook] quiz session update failed:", e);
    }
  }

  // the event id dedupes across webhook re-deliveries
  await inngest.send({
    id: `order-paid-${orderId}`,
    name: "order/paid",
    data: { orderId },
  });
}

async function handleChargeRefunded(charge: Stripe.Charge) {
  const paymentIntentId =
    typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
  if (!paymentIntentId) return;

  const admin = supabaseAdmin();
  const { data: order } = await admin
    .from("orders")
    .select("*")
    .eq("stripe_payment_intent", paymentIntentId)
    .maybeSingle();
  if (!order) return; // not one of ours

  if (!order.refunded_at) {
    await admin
      .from("orders")
      .update({
        refunded_at: new Date().toISOString(),
        // a generation-failure refund keeps its failed status for the order page
        ...(order.status !== "failed" ? { status: "refunded" } : {}),
      })
      .eq("id", order.id);
  }

  const creatorId = await creatorIdForOrder(order as OrderRow);
  if (creatorId) await recordRefund(order as OrderRow, creatorId, charge.id);
}

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[stripe webhook] STRIPE_WEBHOOK_SECRET not set");
    return NextResponse.json({ error: "not configured" }, { status: 500 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "missing signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = await stripe().webhooks.constructEventAsync(await req.text(), signature, secret);
  } catch (e) {
    console.error("[stripe webhook] signature verification failed:", e);
    return NextResponse.json({ error: "bad signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object);
        break;
      case "charge.refunded":
        await handleChargeRefunded(event.data.object);
        break;
      default:
        break; // subscribed events only; anything else is a no-op
    }
  } catch (e) {
    // non-2xx → Stripe retries; every handler path is idempotent
    console.error(`[stripe webhook] ${event.type} failed:`, e);
    return NextResponse.json({ error: "handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
