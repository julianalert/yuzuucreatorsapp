import "server-only";
import { supabaseAdmin } from "./supabase/admin";
import type { BuildRow } from "./db/types";

export async function latestBuild(creatorId: string): Promise<BuildRow | null> {
  const { data } = await supabaseAdmin()
    .from("builds")
    .select("*")
    .eq("creator_id", creatorId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as BuildRow) ?? null;
}

const SCAN_STAGES = ["scrape", "extract", "propose"];

/** Which screen a build belongs on. */
export function routeForBuild(build: BuildRow | null): string {
  if (!build) return "/onboard";
  switch (build.status) {
    case "queued": {
      // the first pipeline step flips status to running within seconds; a build
      // queued for this long means the event was never picked up (e.g. Inngest
      // not configured) — don't trap the creator on the scanning screen
      const ageMs = Date.now() - new Date(build.created_at).getTime();
      return ageMs > 15 * 60 * 1000 ? "/onboard" : "/onboard/scanning";
    }
    case "running":
      return SCAN_STAGES.includes(build.stage ?? "scrape")
        ? "/onboard/scanning"
        : "/onboard/building";
    case "awaiting_topic":
      return "/onboard/ideas";
    case "awaiting_approval":
      return "/onboard/review";
    case "complete":
      return "/dashboard";
    case "declined":
    case "failed":
    default:
      return "/onboard";
  }
}
