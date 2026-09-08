"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { inngest } from "@/lib/inngest/client";
import { deleteSpecCreator, specEmailFor } from "@/lib/spec";

const HANDLE_RE = /^[a-zA-Z0-9._]{1,30}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function back(msg: string): never {
  redirect(`/admin/spec?error=${encodeURIComponent(msg)}`);
}

/**
 * Pre-build a product for a creator who has never heard of Yuzuu.
 *
 * The account is real (the pipeline needs an owner and the page needs a slug)
 * but unreachable: no password, no OAuth identity, an address on a domain we
 * own. It becomes a normal account at handover, when its email is swapped for
 * the creator's own and Google links an identity to it on their first sign-in.
 */
export async function createSpecBuild(formData: FormData) {
  await requireAdmin();
  const handle = String(formData.get("handle") ?? "")
    .replace(/^@/, "")
    .trim()
    .toLowerCase();
  const selfDescription = String(formData.get("self_description") ?? "").trim();

  if (!HANDLE_RE.test(handle)) back(`"${handle}" is not a valid Instagram handle`);

  const admin = supabaseAdmin();

  // the handle is the public slug — one creator per handle, spec or not
  const { data: taken } = await admin
    .from("creators")
    .select("id, is_spec")
    .eq("handle", handle)
    .maybeSingle();
  if (taken) {
    back(
      taken.is_spec
        ? `@${handle} already has a spec build — discard it first to rebuild`
        : `@${handle} is already a real creator`
    );
  }

  const email = specEmailFor(handle);
  const { data: created, error: authErr } = await admin.auth.admin.createUser({
    email,
    // no password and no OAuth identity: nobody can sign in as this account
    // until handover swaps the address to a real one
    email_confirm: true,
  });
  if (authErr || !created?.user) back(`auth: ${authErr?.message ?? "could not create the user"}`);
  const userId = created.user.id;

  // From here on, any failure leaves an orphaned auth user, so unwind it.
  const undo = async (msg: string): Promise<never> => {
    await admin.auth.admin.deleteUser(userId).catch(() => {});
    return back(msg);
  };

  const { data: creator, error: cErr } = await admin
    .from("creators")
    .insert({ user_id: userId, email, handle, is_spec: true })
    .select("id")
    .single();
  if (cErr || !creator) await undo(`creator row: ${cErr?.message ?? "insert failed"}`);

  const { data: build, error: bErr } = await admin
    .from("builds")
    .insert({ creator_id: creator!.id, status: "queued" })
    .select("id")
    .single();
  if (bErr || !build) {
    await admin.from("creators").delete().eq("id", creator!.id);
    await undo(`build row: ${bErr?.message ?? "insert failed"}`);
  }

  await inngest.send({
    name: "build/requested",
    data: {
      buildId: build!.id,
      creatorId: creator!.id,
      handle,
      selfDescription: selfDescription || undefined,
    },
  });

  revalidatePath("/admin/spec");
  redirect(`/admin/spec?started=${encodeURIComponent(handle)}`);
}

/**
 * The creator said yes. Point the account at their real address so their next
 * "Sign in with Google" links an identity to this user rather than making a
 * new one, and stop treating it as spec so normal lifecycle mail resumes.
 */
export async function handOverSpecCreator(formData: FormData) {
  await requireAdmin();
  const creatorId = String(formData.get("creator_id") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) back(`"${email}" is not a valid email address`);

  const admin = supabaseAdmin();
  const { data: creator } = await admin
    .from("creators")
    .select("id, user_id, handle, is_spec")
    .eq("id", creatorId)
    .maybeSingle();
  if (!creator) back("no such creator");
  if (!creator.is_spec) back(`@${creator.handle} has already been handed over`);

  // Supabase keys identity linking on a unique verified email; a duplicate
  // would fail there anyway, but fail here with something readable.
  const { data: clash } = await admin
    .from("creators")
    .select("id")
    .eq("email", email)
    .neq("id", creatorId)
    .maybeSingle();
  if (clash) back(`${email} is already on another Yuzuu account`);

  const { error: authErr } = await admin.auth.admin.updateUserById(creator.user_id, {
    email,
    // confirmed, or Google will refuse to auto-link on first sign-in
    email_confirm: true,
  });
  if (authErr) back(`auth: ${authErr.message}`);

  // creators.email is a separate column from auth.users.email — both move
  const { error: cErr } = await admin
    .from("creators")
    .update({ email, is_spec: false })
    .eq("id", creatorId);
  if (cErr) back(`creator row: ${cErr.message}`);

  revalidatePath("/admin/spec");
  redirect(`/admin/spec?handed=${encodeURIComponent(creator.handle ?? "")}`);
}

/**
 * The pitch went nowhere. Remove the account entirely so the handle is free
 * and we are not sitting on a product built from someone's Instagram who did
 * not want it — this is also what answers a deletion request.
 */
export async function discardSpecCreator(formData: FormData) {
  await requireAdmin();
  const creatorId = String(formData.get("creator_id") ?? "");

  const { data: creator } = await supabaseAdmin()
    .from("creators")
    .select("handle")
    .eq("id", creatorId)
    .maybeSingle();

  const err = await deleteSpecCreator(creatorId);
  if (err) back(err);

  revalidatePath("/admin/spec");
  redirect(`/admin/spec?discarded=${encodeURIComponent(creator?.handle ?? "")}`);
}
