"use server";

import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Dev-only email+password sign-in so local testing doesn't require the Google
 * OAuth app. Creates the auth user on first use. Hard-disabled unless
 * NEXT_PUBLIC_DEV_LOGIN=true — never set that in production.
 */
export async function devSignIn(formData: FormData) {
  if (process.env.NEXT_PUBLIC_DEV_LOGIN !== "true") redirect("/auth");

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || password.length < 6) redirect("/auth?error=dev");

  const admin = supabaseAdmin();
  // idempotent: create the user, or reset the password if it already exists —
  // this is a dev-only tool, convenience beats ceremony
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr && !created?.user) {
    const { data: list } = await admin.auth.admin.listUsers();
    const existing = list?.users.find((u) => u.email?.toLowerCase() === email);
    if (existing) {
      await admin.auth.admin.updateUserById(existing.id, { password, email_confirm: true });
    } else {
      console.error("[devSignIn] createUser:", createErr.message);
      redirect("/auth?error=dev");
    }
  }

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    console.error("[devSignIn] signInWithPassword:", error.message);
    redirect("/auth?error=dev");
  }

  redirect("/onboard");
}
