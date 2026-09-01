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

/** Loose IBAN shape check — 2-letter country code, 2 check digits, up to 30
 * alphanumerics, no spaces. Real validation (mod-97) happens on the admin
 * side before a transfer goes out. */
const IBAN_RE = /^[A-Z]{2}\d{2}[A-Z0-9]{1,30}$/;

/**
 * Bank transfer is the only payout method. Saving puts the details in
 * review; an admin flips payout_status to 'ready' before the first payout.
 */
export async function setPayoutDetails(formData: FormData) {
  const creator = await requireCreator();
  const field = (name: string) => String(formData.get(name) ?? "").trim();

  const iban = field("payout_iban").replace(/\s+/g, "").toUpperCase().slice(0, 34);
  const firstName = field("payout_first_name").slice(0, 100);
  const lastName = field("payout_last_name").slice(0, 100);
  const company = field("payout_company").slice(0, 150);
  const address = field("payout_address").slice(0, 300);

  if (!IBAN_RE.test(iban) || !firstName || !lastName || !address) return;

  await supabaseAdmin()
    .from("creators")
    .update({
      payout_provider: "bank",
      payout_iban: iban,
      payout_first_name: firstName,
      payout_last_name: lastName,
      payout_company: company || null,
      payout_address: address,
      // edits always go back through review
      payout_status: "pending",
    })
    .eq("id", creator.id);
  revalidatePath("/dashboard");
}

/** Creator says they're done with the launch checklist — hide it for good. */
export async function dismissLaunchChecklist() {
  const creator = await requireCreator();
  await supabaseAdmin()
    .from("creators")
    .update({ launch_checklist_dismissed_at: new Date().toISOString() })
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
