import "server-only";
import { supabaseAdmin } from "./supabase/admin";
import { inngest } from "./inngest/client";

/**
 * Address domain for spec accounts. Nothing sends from it and nothing needs to
 * read it — lifecycle mail is suppressed for is_spec creators — so a free
 * catch-all forward on the domain is enough to catch anything unforeseen.
 */
const SPEC_EMAIL_DOMAIN = process.env.SPEC_EMAIL_DOMAIN || "build.yuzuu.co";

export function specEmailFor(handle: string): string {
  return `${handle}@${SPEC_EMAIL_DOMAIN}`;
}

/**
 * Delete a spec account and everything built under it.
 *
 * Refuses on anything that isn't a spec account, and on any account with
 * orders against it — a spec product is never published so it cannot have
 * been bought, and if that turns out to be false the money wins.
 *
 * Returns an error string rather than throwing: both callers want to carry on
 * (the admin sees a message, the claim path falls through to normal signup).
 */
export async function deleteSpecCreator(creatorId: string): Promise<string | null> {
  const admin = supabaseAdmin();
  const { data: creator } = await admin
    .from("creators")
    .select("id, user_id, handle, is_spec")
    .eq("id", creatorId)
    .maybeSingle();
  if (!creator) return "no such creator";
  if (!creator.is_spec) return "that is a real creator — refusing to delete";

  const { data: blueprints } = await admin
    .from("blueprints")
    .select("id")
    .eq("creator_id", creatorId);
  const bpIds = (blueprints ?? []).map((b) => b.id);

  if (bpIds.length) {
    const { count } = await admin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .in("blueprint_id", bpIds);
    if (count) return "this creator has orders — not deleting";
  }

  // cancels any run parked on wait-topic or wait-review (cancelOn build/discarded)
  const { data: builds } = await admin.from("builds").select("id").eq("creator_id", creatorId);
  for (const b of builds ?? []) {
    try {
      await inngest.send({ name: "build/discarded", data: { buildId: b.id } });
    } catch (e) {
      console.error("deleteSpecCreator: cancel event failed", e);
    }
  }

  // no FK is ON DELETE CASCADE, so unwind children first
  if (bpIds.length) {
    await admin.from("samples").delete().in("blueprint_id", bpIds);
    await admin.from("quiz_sessions").delete().in("blueprint_id", bpIds);
  }
  await admin.from("creator_events").delete().eq("creator_id", creatorId);
  await admin.from("lifecycle_emails").delete().eq("creator_id", creatorId);
  await admin.from("blueprints").delete().eq("creator_id", creatorId);
  await admin.from("builds").delete().eq("creator_id", creatorId);
  const { error } = await admin.from("creators").delete().eq("id", creatorId);
  if (error) return `creator delete: ${error.message}`;

  await admin.auth.admin.deleteUser(creator.user_id).catch((e) => {
    console.error("deleteSpecCreator: auth delete failed", e);
  });
  return null;
}

/**
 * A creator arriving through the front door for a handle we already spec-built
 * on. Without this they hit "that handle is taken" — our own outreach blocking
 * the signup it exists to cause.
 *
 * The two accounts can't be merged (separate auth users), so the pitch loses:
 * the spec account is deleted and the real signup proceeds normally, building
 * them the product they just asked for. The spec build's spend is sunk either
 * way, and this is the path where they said yes.
 *
 * Returns true if a handle was released.
 */
export async function releaseSpecHandle(handle: string): Promise<boolean> {
  const { data: holder } = await supabaseAdmin()
    .from("creators")
    .select("id, is_spec")
    .eq("handle", handle.toLowerCase())
    .maybeSingle();
  if (!holder?.is_spec) return false;

  const err = await deleteSpecCreator(holder.id);
  if (err) {
    console.error(`releaseSpecHandle(@${handle}): ${err}`);
    return false;
  }
  console.info(`releaseSpecHandle: dropped the spec build for @${handle} — they signed up`);
  return true;
}
