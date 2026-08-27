import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _admin: SupabaseClient | undefined;

/**
 * Service-role client. Bypasses RLS — server code only. All buyer-facing reads
 * go through this so blueprint IP (content_bank, knowledge_pack) never leaves
 * the server.
 */
export function supabaseAdmin(): SupabaseClient {
  if (_admin) return _admin;
  _admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  return _admin;
}
