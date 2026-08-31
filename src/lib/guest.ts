import "server-only";
import { cookies } from "next/headers";
import { supabaseAdmin } from "./supabase/admin";
import type { BuildRow } from "./db/types";

/**
 * Guest builds: the scan → ideas phase runs before signup. Ownership is an
 * httpOnly cookie holding a random token that matches builds.guest_token.
 * The token (and the cookie) die at claim time, when the build gets a creator.
 */
export const GUEST_COOKIE = "yz_build";

const GUEST_COOKIE_MAX_AGE = 7 * 24 * 3600; // matches the 7-day topic timeout

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function readGuestToken(): Promise<string | null> {
  const store = await cookies();
  const value = store.get(GUEST_COOKIE)?.value ?? "";
  return UUID_RE.test(value) ? value : null;
}

/** Read or mint the guest token. Callable only where cookies can be set
 * (server actions / route handlers). */
export async function ensureGuestToken(): Promise<string> {
  const existing = await readGuestToken();
  if (existing) return existing;
  const token = crypto.randomUUID();
  const store = await cookies();
  store.set(GUEST_COOKIE, token, {
    path: "/",
    maxAge: GUEST_COOKIE_MAX_AGE,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return token;
}

export async function clearGuestToken(): Promise<void> {
  const store = await cookies();
  store.delete(GUEST_COOKIE);
}

/** Newest unclaimed build owned by this guest token. Claimed builds drop out
 * naturally — their guest_token is nulled when the creator is attached. */
export async function latestGuestBuild(token: string): Promise<BuildRow | null> {
  const { data } = await supabaseAdmin()
    .from("builds")
    .select("*")
    .eq("guest_token", token)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as BuildRow) ?? null;
}

const SCAN_STAGES = ["scrape", "extract", "propose"];

/** True while the guest build is still worth returning to. */
export function isActiveGuestBuild(build: BuildRow): boolean {
  switch (build.status) {
    case "queued":
      // same stale rule as routeForBuild — a build queued this long means the
      // event was never picked up
      return Date.now() - new Date(build.created_at).getTime() <= 15 * 60 * 1000;
    case "running":
      return SCAN_STAGES.includes(build.stage ?? "scrape");
    case "awaiting_topic":
      return true;
    default:
      return false;
  }
}

/** Which screen a guest build belongs on — the /start mirror of routeForBuild.
 * Post-topic statuses map to the creator flow: they only occur after claim. */
export function routeForGuestBuild(build: BuildRow | null): string {
  if (!build) return "/";
  switch (build.status) {
    case "queued":
      return isActiveGuestBuild(build) ? "/start/scanning" : "/?error=failed";
    case "running":
      return SCAN_STAGES.includes(build.stage ?? "scrape")
        ? "/start/scanning"
        : "/onboard/building";
    case "awaiting_topic":
      return "/start/ideas";
    case "awaiting_approval":
      return "/onboard/review";
    case "complete":
      return "/dashboard";
    case "declined":
    case "failed":
    default:
      return `/?error=${encodeURIComponent(build.halted_at ?? build.status)}`;
  }
}
