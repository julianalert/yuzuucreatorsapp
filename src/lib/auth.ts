import "server-only";
import { redirect } from "next/navigation";
import { supabaseServer } from "./supabase/server";
import { supabaseAdmin } from "./supabase/admin";
import type { CreatorRow } from "./db/types";

/**
 * Resolve the signed-in user and their creators row, creating the row on
 * first sign-in. Redirects to /auth when signed out.
 */
export async function requireCreator(): Promise<CreatorRow> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const avatarUrl =
    (user.user_metadata?.avatar_url as string | undefined) ??
    (user.user_metadata?.picture as string | undefined) ??
    null;

  const admin = supabaseAdmin();
  const { data: existing } = await admin
    .from("creators")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing) {
    // Keep the avatar in sync (covers accounts created before this field
    // existed, and creators who update their Google photo later).
    if (avatarUrl && avatarUrl !== existing.avatar_url) {
      const { data: updated } = await admin
        .from("creators")
        .update({ avatar_url: avatarUrl })
        .eq("id", existing.id)
        .select("*")
        .single();
      if (updated) return updated as CreatorRow;
    }
    return existing as CreatorRow;
  }

  const { data: created, error } = await admin
    .from("creators")
    .insert({
      user_id: user.id,
      email: user.email ?? "",
      display_name:
        (user.user_metadata?.full_name as string | undefined) ??
        (user.user_metadata?.name as string | undefined) ??
        null,
      avatar_url: avatarUrl,
    })
    .select("*")
    .single();
  if (error) throw error;
  return created as CreatorRow;
}

export async function getSignedInUser() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
