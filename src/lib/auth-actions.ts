"use server";

import { redirect } from "next/navigation";
import { supabaseServer } from "./supabase/server";

export async function signOut() {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  redirect("/auth");
}
