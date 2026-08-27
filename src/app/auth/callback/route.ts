import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const NEXT_COOKIE = "yz_next";

/** OAuth code exchange — Google redirects here after consent. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  const cookieStore = await cookies();
  // redirectTo is kept query-free so it matches the Supabase allow list
  // exactly (see GoogleButton) — `next` travels via cookie instead. The
  // `next` query param is still honored for callers that pass it directly
  // (e.g. the root-page OAuth-code fallback).
  const next = cookieStore.get(NEXT_COOKIE)?.value ?? searchParams.get("next") ?? "/dashboard";
  cookieStore.set(NEXT_COOKIE, "", { maxAge: 0, path: "/" });

  if (code) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (cookiesToSet) =>
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            ),
        },
      }
    );
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
    console.error("[auth/callback] exchangeCodeForSession failed:", error.message);
  } else {
    console.error("[auth/callback] no ?code= on callback request");
  }

  return NextResponse.redirect(`${origin}/auth?error=auth`);
}
