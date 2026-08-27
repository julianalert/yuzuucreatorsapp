"use server";

import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { publishedProductByHandle } from "@/lib/public";
import { sendEvent } from "@/lib/inngest/client";
import type { QuizAnswers } from "@/lib/blueprint/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Fake pay: no Stripe yet. Clicking "Pay now" creates a paid order and kicks
 * off plan.generate. `orders.stripe_payment_intent` stays nullable for later.
 */
export async function createOrder(formData: FormData) {
  const handle = String(formData.get("handle") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const answersRaw = String(formData.get("answers") ?? "");

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

  const admin = supabaseAdmin();
  const { data: order, error } = await admin
    .from("orders")
    .insert({
      blueprint_id: product.blueprintId,
      blueprint_version: product.version,
      buyer_email: email,
      quiz_answers: answers,
      amount_cents: product.priceCents,
      status: "paid",
    })
    .select("id")
    .single();
  if (error) throw new Error(`order insert: ${error.message}`);

  await sendEvent("order/paid", { orderId: order.id });

  redirect(`/order/${order.id}`);
}
