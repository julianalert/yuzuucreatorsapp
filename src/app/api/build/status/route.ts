import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { readGuestToken } from "@/lib/guest";

/** Polled by the progress screens. Scoped to the signed-in creator, or — for
 * pre-signup guest builds — to the browser holding the guest cookie. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  const admin = supabaseAdmin();
  const { data: build } = await admin
    .from("builds")
    .select("id, creator_id, guest_token, status, stage, halted_at, error")
    .eq("id", id)
    .single();
  if (!build) return NextResponse.json({ error: "not found" }, { status: 404 });

  let authorized = false;

  const guestToken = await readGuestToken();
  if (guestToken && build.guest_token === guestToken) authorized = true;

  if (!authorized) {
    const supabase = await supabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const { data: creator } = await admin
      .from("creators")
      .select("id")
      .eq("user_id", user.id)
      .single();
    authorized = Boolean(creator && build.creator_id === creator.id);
  }

  if (!authorized) return NextResponse.json({ error: "not found" }, { status: 404 });

  return NextResponse.json({
    status: build.status,
    stage: build.stage,
    halted_at: build.halted_at,
  });
}
