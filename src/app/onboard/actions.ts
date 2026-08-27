"use server";

import { redirect } from "next/navigation";
import { requireCreator } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { inngest } from "@/lib/inngest/client";

const HANDLE_RE = /^[a-zA-Z0-9._]{1,30}$/;

export async function startBuild(formData: FormData) {
  const creator = await requireCreator();
  const raw = String(formData.get("handle") ?? "").replace(/^@/, "").trim().toLowerCase();
  const selfDescription = String(formData.get("self_description") ?? "").trim();

  if (!HANDLE_RE.test(raw)) redirect("/onboard?error=handle");

  const admin = supabaseAdmin();

  // per-creator build cap
  const limit = Number(process.env.PER_CREATOR_BUILD_LIMIT || 5);
  const { count } = await admin
    .from("builds")
    .select("id", { count: "exact", head: true })
    .eq("creator_id", creator.id);
  if ((count ?? 0) >= limit) redirect("/onboard?error=limit");

  // handle is the URL slug — one creator per handle
  const { data: taken } = await admin
    .from("creators")
    .select("id")
    .eq("handle", raw)
    .neq("id", creator.id)
    .maybeSingle();
  if (taken) redirect("/onboard?error=taken");

  await admin.from("creators").update({ handle: raw }).eq("id", creator.id);

  const { data: build, error } = await admin
    .from("builds")
    .insert({ creator_id: creator.id, status: "queued" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await inngest.send({
    name: "build/requested",
    data: {
      buildId: build.id,
      creatorId: creator.id,
      handle: raw,
      selfDescription: selfDescription || undefined,
    },
  });

  redirect("/onboard/scanning");
}

export async function chooseTopic(formData: FormData) {
  const creator = await requireCreator();
  const buildId = String(formData.get("build_id"));
  const topicIndex = Number(formData.get("topic_index"));
  if (!Number.isInteger(topicIndex) || topicIndex < 0) redirect("/onboard/ideas");

  const admin = supabaseAdmin();
  const { data: build } = await admin
    .from("builds")
    .select("id, creator_id, status")
    .eq("id", buildId)
    .single();
  if (!build || build.creator_id !== creator.id || build.status !== "awaiting_topic") {
    redirect("/onboard");
  }

  await admin.from("builds").update({ status: "running", stage: "knowledge" }).eq("id", buildId);
  await inngest.send({ name: "build/topic.chosen", data: { buildId, topicIndex } });

  redirect("/onboard/building");
}

export async function reviewSamples(formData: FormData) {
  const creator = await requireCreator();
  const buildId = String(formData.get("build_id"));
  const approved = String(formData.get("decision")) === "approve";
  const reason = String(formData.get("reason") ?? "").trim();

  const admin = supabaseAdmin();
  const { data: build } = await admin
    .from("builds")
    .select("id, creator_id, status")
    .eq("id", buildId)
    .single();
  if (!build || build.creator_id !== creator.id || build.status !== "awaiting_approval") {
    redirect("/onboard");
  }

  await inngest.send({
    name: "build/samples.reviewed",
    data: { buildId, approved, reason: reason || undefined },
  });

  if (approved) {
    // publish runs async in the job — keep the build "running" so the progress
    // screen holds until it flips to complete, then the poller sends them home
    await admin.from("builds").update({ status: "running", stage: "publish" }).eq("id", buildId);
    redirect("/onboard/building");
  }
  await admin.from("builds").update({ status: "failed", halted_at: "rejected_by_creator" }).eq("id", buildId);
  redirect("/onboard/scanning?rebuilding=1");
}
