"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSignedInUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { inngest } from "@/lib/inngest/client";
import { cleanHandle, isValidHandle, HANDLE_COOKIE } from "@/lib/pending-handle";
import {
  clearGuestToken,
  ensureGuestToken,
  isActiveGuestBuild,
  latestGuestBuild,
  readGuestToken,
  routeForGuestBuild,
} from "@/lib/guest";

/** Hard cap on builds per guest cookie — regenerations included. Signed-in
 * creators have PER_CREATOR_BUILD_LIMIT; this is the anonymous equivalent. */
const PER_GUEST_BUILD_CAP = 5;

async function cancelPipeline(buildId: string) {
  // best-effort: kills the run parked on wait-topic (same pattern as
  // discardBuild — an unreachable Inngest just means a later timeout)
  try {
    await inngest.send({ name: "build/discarded", data: { buildId } });
  } catch (e) {
    console.error("guest cancel event failed", e);
  }
}

/**
 * The homepage handle form: start scanning immediately, no account needed.
 * Signup happens later, when the visitor picks an idea to build.
 */
export async function startGuestBuild(formData: FormData) {
  const raw = cleanHandle(String(formData.get("handle") ?? ""));
  if (!isValidHandle(raw)) redirect("/?error=handle");

  // signed-in creators keep the original flow — carry the handle to /onboard
  const user = await getSignedInUser();
  if (user) {
    const store = await cookies();
    store.set(HANDLE_COOKIE, raw, { path: "/", maxAge: 3600, sameSite: "lax" });
    redirect("/onboard");
  }

  const admin = supabaseAdmin();
  const token = await ensureGuestToken();

  const existing = await latestGuestBuild(token);
  if (existing && isActiveGuestBuild(existing)) {
    // same handle → return to the session in progress instead of paying twice
    if (existing.handle === raw) redirect(routeForGuestBuild(existing));
    // new handle replaces the old session
    await cancelPipeline(existing.id);
    if (existing.status === "awaiting_topic" || existing.status === "queued") {
      await admin.from("builds").delete().eq("id", existing.id);
    } else {
      await admin
        .from("builds")
        .update({
          status: "failed",
          halted_at: "guest_replaced",
          completed_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    }
  }

  const { count } = await admin
    .from("builds")
    .select("id", { count: "exact", head: true })
    .eq("guest_token", token);
  if ((count ?? 0) >= PER_GUEST_BUILD_CAP) redirect("/?error=limit");

  const { data: build, error } = await admin
    .from("builds")
    .insert({ creator_id: null, guest_token: token, handle: raw, status: "queued" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await inngest.send({
    name: "build/requested",
    data: { buildId: build.id, creatorId: null, handle: raw },
  });

  redirect("/start/scanning");
}

/** Loads the guest's build or bounces them home. Shared by the guest actions. */
async function requireGuestBuild(buildId: string) {
  const token = await readGuestToken();
  if (!token) redirect("/");
  const { data: build } = await supabaseAdmin()
    .from("builds")
    .select("id, guest_token, creator_id, status, handle, topic_proposals")
    .eq("id", buildId)
    .single();
  if (!build || build.guest_token !== token || build.creator_id) redirect("/");
  return { build, token };
}

/**
 * The signup gate. The pick is saved on the build, then the visitor goes
 * through Google auth; /start/claim attaches the new creator and fires
 * build/topic.chosen so the parked pipeline resumes.
 */
export async function chooseTopicGuest(formData: FormData) {
  const buildId = String(formData.get("build_id"));
  const topicIndex = Number(formData.get("topic_index"));
  if (!Number.isInteger(topicIndex) || topicIndex < 0) redirect("/start/ideas");

  const { build } = await requireGuestBuild(buildId);
  if (build.status !== "awaiting_topic") redirect("/");

  await supabaseAdmin()
    .from("builds")
    .update({ pending_topic_index: topicIndex })
    .eq("id", buildId);

  // /auth redirects already-signed-in visitors straight to `next`
  redirect("/auth?next=/start/claim");
}

/** Guest mirror of regenerateIdeas — same 2-regeneration cap, keyed on the
 * guest token instead of the creator. */
export async function regenerateIdeasGuest(formData: FormData) {
  const buildId = String(formData.get("build_id"));
  const reason = String(formData.get("regen_reason") ?? "").trim();

  const { build, token } = await requireGuestBuild(buildId);
  if (build.status !== "awaiting_topic") redirect("/");

  const admin = supabaseAdmin();
  const { count: regens } = await admin
    .from("builds")
    .select("id", { count: "exact", head: true })
    .eq("guest_token", token)
    .eq("halted_at", "ideas_regenerated");
  if ((regens ?? 0) >= 2) redirect("/start/ideas?error=regen_limit");

  await cancelPipeline(buildId);

  await admin
    .from("builds")
    .update({
      status: "failed",
      halted_at: "ideas_regenerated",
      completed_at: new Date().toISOString(),
    })
    .eq("id", buildId);

  const { data: next, error } = await admin
    .from("builds")
    .insert({ creator_id: null, guest_token: token, handle: build.handle, status: "queued" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const rejectedTitles = (
    ((build.topic_proposals as { proposals?: { topic_title: string }[] } | null)?.proposals ??
      []) as { topic_title: string }[]
  ).map((p) => p.topic_title);
  const rejectReason =
    `The creator saw these product ideas and said none of them fit: ${rejectedTitles.join("; ") || "(unknown)"}. ` +
    `Propose genuinely different angles — do not rephrase the rejected ones.` +
    (reason ? ` Their words: ${reason}` : "");

  await inngest.send({
    name: "build/requested",
    data: {
      buildId: next.id,
      creatorId: null,
      handle: build.handle ?? "",
      rebuildOfBuildId: buildId,
      rejectReason,
    },
  });

  redirect("/start/scanning?rebuilding=1");
}

export async function discardGuestBuild(formData: FormData) {
  const buildId = String(formData.get("build_id"));
  const { build } = await requireGuestBuild(buildId);
  // only deletable before anything expensive was built — the ideas step
  if (build.status !== "awaiting_topic") redirect("/");

  await cancelPipeline(buildId);
  const { error } = await supabaseAdmin().from("builds").delete().eq("id", buildId);
  if (error) throw new Error(error.message);
  await clearGuestToken();

  redirect("/");
}
