"use server";

import { revalidatePath } from "next/cache";
import { requireCreator } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { LaunchChecklist } from "@/lib/db/types";

const CHECKLIST_ITEMS = ["quiz", "link", "bio", "story"] as const;
type ChecklistItem = (typeof CHECKLIST_ITEMS)[number];

function isChecklistItem(v: string): v is ChecklistItem {
  return (CHECKLIST_ITEMS as readonly string[]).includes(v);
}

/** Toggle a launch-checklist item. Checking stamps now; unchecking clears. */
export async function setChecklistItem(item: string, done: boolean) {
  if (!isChecklistItem(item)) return;
  const creator = await requireCreator();
  const checklist: LaunchChecklist = { ...(creator.launch_checklist ?? {}) };
  if (done) checklist[item] = new Date().toISOString();
  else delete checklist[item];
  await supabaseAdmin()
    .from("creators")
    .update({ launch_checklist: checklist })
    .eq("id", creator.id);
  revalidatePath("/dashboard");
}

const PAYOUT_PROVIDERS = ["paypal", "bank", "other"] as const;

/**
 * How the creator wants their monthly payout. We store an email or short
 * note — never full bank numbers (see docs/payments.md). Saving puts the
 * details in review; an admin flips payout_status to 'ready'.
 */
export async function setPayoutDetails(formData: FormData) {
  const creator = await requireCreator();
  const provider = String(formData.get("payout_provider") ?? "");
  const recipient = String(formData.get("payout_recipient") ?? "").trim().slice(0, 200);
  if (!(PAYOUT_PROVIDERS as readonly string[]).includes(provider) || !recipient) return;

  await supabaseAdmin()
    .from("creators")
    .update({
      payout_provider: provider,
      payout_recipient_id: recipient,
      // edits always go back through review
      payout_status: "pending",
    })
    .eq("id", creator.id);
  revalidatePath("/dashboard");
}

/** The copy button was clicked: log the share-intent event + tick the item. */
export async function recordLinkCopied() {
  const creator = await requireCreator();
  const admin = supabaseAdmin();

  const { data: bp } = await admin
    .from("blueprints")
    .select("id")
    .eq("creator_id", creator.id)
    .eq("published", true)
    .maybeSingle();

  await admin.from("creator_events").insert({
    creator_id: creator.id,
    blueprint_id: bp?.id ?? null,
    type: "link_copied",
  });

  if (!creator.launch_checklist?.link) {
    await admin
      .from("creators")
      .update({
        launch_checklist: { ...(creator.launch_checklist ?? {}), link: new Date().toISOString() },
      })
      .eq("id", creator.id);
    revalidatePath("/dashboard");
  }
}
