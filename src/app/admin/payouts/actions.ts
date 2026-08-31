"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { draftPayoutRuns, confirmPayout, markPayoutPaid } from "@/lib/payouts";
import { sendPayoutPaid } from "@/lib/email";

function backWithError(e: unknown): never {
  const msg = e instanceof Error ? e.message : "something went wrong";
  redirect(`/admin/payouts?error=${encodeURIComponent(msg)}`);
}

/** Same run the monthly cron performs — on demand. */
export async function generateDraftRun() {
  await requireAdmin();
  const { created, skipped } = await draftPayoutRuns();
  revalidatePath("/admin/payouts");
  redirect(
    `/admin/payouts?drafted=${created}${skipped.length ? `&skipped=${encodeURIComponent(skipped.join(" · "))}` : ""}`
  );
}

/** Confirm the creator's payout details after checking them. */
export async function markPayoutDetailsReady(formData: FormData) {
  await requireAdmin();
  const creatorId = String(formData.get("creator_id") ?? "");
  if (!creatorId) return;
  await supabaseAdmin()
    .from("creators")
    .update({ payout_status: "ready" })
    .eq("id", creatorId)
    .eq("payout_status", "pending");
  revalidatePath("/admin/payouts");
}

export async function confirmPayoutAction(formData: FormData) {
  await requireAdmin();
  const payoutId = String(formData.get("payout_id") ?? "");
  try {
    await confirmPayout(payoutId);
  } catch (e) {
    backWithError(e);
  }
  revalidatePath("/admin/payouts");
  redirect(`/admin/payouts/${payoutId}`);
}

export async function markPaidAction(formData: FormData) {
  await requireAdmin();
  const payoutId = String(formData.get("payout_id") ?? "");
  const externalRef = String(formData.get("external_ref") ?? "").trim();
  let payout;
  try {
    payout = await markPayoutPaid(payoutId, externalRef);
  } catch (e) {
    backWithError(e);
  }

  // tell the creator their money is on the way (best-effort)
  const { data: creator } = await supabaseAdmin()
    .from("creators")
    .select("email")
    .eq("id", payout.creator_id)
    .single();
  if (creator?.email) {
    await sendPayoutPaid(creator.email, {
      amountCents: payout.amount_cents,
      periodEnd: payout.period_end,
    });
  }

  revalidatePath("/admin/payouts");
  redirect(`/admin/payouts/${payoutId}`);
}
