import { redirect } from "next/navigation";
import { getSignedInUser, requireCreator } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { inngest } from "@/lib/inngest/client";
import { latestBuild, routeForBuild } from "@/lib/builds";
import { clearGuestToken, latestGuestBuild, readGuestToken } from "@/lib/guest";
import { clearPendingHandle } from "@/lib/pending-handle.server";

/**
 * The moment signup meets the guest build. Runs right after Google auth
 * (/auth?next=/start/claim): attaches the fresh creator to the guest build,
 * sets their handle, and — if an idea was already picked — fires
 * build/topic.chosen so the pipeline parked on wait-topic resumes.
 *
 * A GET with side effects, like the OAuth callback it follows.
 */
export async function GET() {
  if (!(await getSignedInUser())) redirect("/auth?next=/start/claim");
  const creator = await requireCreator();
  const admin = supabaseAdmin();

  const token = await readGuestToken();
  const build = token ? await latestGuestBuild(token) : null;

  // nothing to claim (expired cookie, already claimed, dead build) —
  // fall into the regular flow, which routes them wherever they belong
  if (!build || build.creator_id) {
    await clearGuestToken();
    redirect("/onboard");
  }

  const claimable =
    build.status === "awaiting_topic" ||
    build.status === "queued" ||
    (build.status === "running" && ["scrape", "extract", "propose"].includes(build.stage ?? "scrape"));
  if (!claimable || !build.handle) {
    await clearGuestToken();
    redirect("/onboard");
  }

  const cancelGuestBuild = async (patch: Record<string, unknown> | null) => {
    try {
      await inngest.send({ name: "build/discarded", data: { buildId: build.id } });
    } catch (e) {
      console.error("claim: cancel event failed", e);
    }
    if (patch) {
      await admin.from("builds").update(patch).eq("id", build.id);
    } else {
      await admin.from("builds").delete().eq("id", build.id);
    }
    await clearGuestToken();
  };

  // handle is the URL slug — one creator per handle
  const { data: taken } = await admin
    .from("creators")
    .select("id")
    .eq("handle", build.handle)
    .neq("id", creator.id)
    .maybeSingle();
  if (taken) {
    await cancelGuestBuild({
      status: "failed",
      halted_at: "guest_handle_taken",
      completed_at: new Date().toISOString(),
    });
    redirect("/onboard?error=taken");
  }

  // an existing creator signing in over a guest session: their own build wins
  // if they're already at the quota — the guest build is dropped, not billed
  const limit = Number(process.env.PER_CREATOR_BUILD_LIMIT || 1);
  const { count } = await admin
    .from("builds")
    .select("id", { count: "exact", head: true })
    .eq("creator_id", creator.id)
    .not("status", "in", "(failed,declined)");
  if ((count ?? 0) >= limit) {
    await cancelGuestBuild(null);
    redirect(routeForBuild(await latestBuild(creator.id)));
  }

  // ---- claim: the build becomes a normal creator build --------------------
  await admin.from("creators").update({ handle: build.handle }).eq("id", creator.id);
  await clearPendingHandle();

  const resume = build.status === "awaiting_topic" && build.pending_topic_index != null;
  const { error } = await admin
    .from("builds")
    .update({
      creator_id: creator.id,
      guest_token: null,
      ...(resume ? { status: "running", stage: "knowledge" } : {}),
    })
    .eq("id", build.id);
  if (error) throw new Error(`claim update: ${error.message}`);
  await clearGuestToken();

  if (resume) {
    // creator_id is committed before this event: the parked run re-reads the
    // owner from the row when wait-topic resolves
    await inngest.send({
      name: "build/topic.chosen",
      data: { buildId: build.id, topicIndex: build.pending_topic_index! },
    });
    redirect("/onboard/building");
  }

  // claimed mid-scan or without a pick — the creator flow takes over
  redirect(routeForBuild({ ...build, creator_id: creator.id }));
}
