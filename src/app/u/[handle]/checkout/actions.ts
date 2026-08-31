"use server";

import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { publishedProductByHandle } from "@/lib/public";
import { stripe } from "@/lib/stripe";
import { absoluteUrl, CREATOR_KEEP_PCT } from "@/lib/seo";
import type { QuizAnswers } from "@/lib/blueprint/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Statement descriptor suffix: buyers see YUZUU* <creator> on their card. */
function descriptorSuffix(handle: string): string | undefined {
  const clean = handle.replace(/[^a-zA-Z0-9 ]/g, "").slice(0, 10).toUpperCase();
  return clean.length >= 2 ? clean : undefined;
}

/**
 * Real pay: insert the order as pending_payment, then send the buyer to
 * hosted Stripe Checkout. The list price is tax-exclusive — Stripe Tax adds
 * VAT/sales tax on top per the registrations in the Stripe dashboard. The
 * webhook (api/stripe/webhook) flips the order to paid and starts generation.
 */
export async function createOrder(formData: FormData) {
  const handle = String(formData.get("handle") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const answersRaw = String(formData.get("answers") ?? "");
  const sessionId = String(formData.get("session_id") ?? "");

  const product = await publishedProductByHandle(handle);
  if (!product) redirect(`/u/${handle}`);
  if (!EMAIL_RE.test(email)) redirect(`/u/${handle}/checkout?error=email`);

  let answers: QuizAnswers;
  try {
    answers = JSON.parse(answersRaw);
  } catch {
    redirect(`/u/${handle}/quiz`);
  }

  // every required question answered with real option ids
  for (const q of product.questions) {
    const a = answers[q.id];
    const ids = Array.isArray(a) ? a : a ? [a] : [];
    const valid = ids.filter((id) => q.options.some((o) => o.id === id));
    if (q.required && valid.length === 0) redirect(`/u/${handle}/quiz`);
    if (q.type === "single" && valid.length > 1) redirect(`/u/${handle}/quiz`);
    answers[q.id] = q.type === "multi" ? valid : valid[0];
  }

  // Tax-exclusive split, frozen at time of sale: net is always the list
  // price, tax rides on top. Gross/tax are filled in by the webhook once
  // Stripe Tax has computed them.
  const netCents = product.priceCents;
  const creatorCents = Math.round((netCents * CREATOR_KEEP_PCT) / 100);
  const platformCents = netCents - creatorCents;

  const admin = supabaseAdmin();
  const { data: order, error } = await admin
    .from("orders")
    .insert({
      blueprint_id: product.blueprintId,
      blueprint_version: product.version,
      buyer_email: email,
      quiz_answers: answers,
      amount_cents: product.priceCents,
      currency: "usd",
      net_cents: netCents,
      creator_cents: creatorCents,
      platform_cents: platformCents,
      status: "pending_payment",
    })
    .select("id")
    .single();
  if (error) throw new Error(`order insert: ${error.message}`);

  let checkoutUrl: string;
  try {
    const session = await stripe().checkout.sessions.create({
      mode: "payment",
      customer_email: email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: product.priceCents,
            tax_behavior: "exclusive",
            product_data: {
              name: product.title,
              description: `Personalized plan by ${product.creatorName}`,
            },
          },
        },
      ],
      // Stripe Tax adds tax as a separate line on top of the $27 price.
      // What gets collected is driven by the dashboard registrations.
      automatic_tax: { enabled: true },
      metadata: { order_id: order.id, quiz_session_id: sessionId || "" },
      payment_intent_data: {
        metadata: { order_id: order.id },
        ...(descriptorSuffix(handle)
          ? { statement_descriptor_suffix: descriptorSuffix(handle) }
          : {}),
      },
      success_url: absoluteUrl(`/order/${order.id}`),
      cancel_url: absoluteUrl(`/u/${handle}/checkout?canceled=1`),
    });
    if (!session.url) throw new Error("checkout session has no url");
    checkoutUrl = session.url;

    await admin
      .from("orders")
      .update({ stripe_checkout_session_id: session.id })
      .eq("id", order.id);
  } catch (e) {
    // never leave a dead pending order behind a failed session
    console.error("[createOrder] stripe session failed:", e);
    await admin.from("orders").delete().eq("id", order.id).eq("status", "pending_payment");
    redirect(`/u/${handle}/checkout?error=pay`);
  }

  redirect(checkoutUrl);
}
