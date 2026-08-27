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
    case "queued":
      return "/onboard/scanning";
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
