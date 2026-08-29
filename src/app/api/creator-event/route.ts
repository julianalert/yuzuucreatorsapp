import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { publishedProductByHandle } from "@/lib/public";
import { getSignedInUser } from "@/lib/auth";
import { sendFirstVisitor } from "@/lib/email";

/**
 * Public beacon for creator-side funnel events. Today: page_visit, fired once
 * per tab session from the sales page. The creator viewing their own page is
 * skipped so preview walks never inflate the numbers.
 */
export async function POST(req: Request) {
  let body: { handle?: string; type?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  if (body.type !== "page_visit") {
    return NextResponse.json({ error: "unknown type" }, { status: 400 });
  }

  const handle = String(body.handle ?? "");
  const product = await publishedProductByHandle(handle);
  if (!product) return NextResponse.json({ error: "unknown product" }, { status: 404 });

  const admin = supabaseAdmin();
  const { data: creator } = await admin
    .from("creators")
    .select("id, user_id, email, handle")
    .eq("handle", handle.toLowerCase())
    .single();
  if (!creator) return NextResponse.json({ error: "unknown creator" }, { status: 404 });

  // owner looking at their own page — a preview, not a visit
  const viewer = await getSignedInUser();
  if (viewer && viewer.id === creator.user_id) {
    return NextResponse.json({ ok: true, skipped: "owner" });
  }

  await admin.from("creator_events").insert({
    creator_id: creator.id,
    blueprint_id: product.blueprintId,
    type: "page_visit",
  });

  // first visitor ever → tell the creator their post is working
  if (creator.email) {
    const { error } = await admin
      .from("lifecycle_emails")
      .insert({ creator_id: creator.id, type: "first_visitor", ref_id: "" });
    if (!error) {
      await sendFirstVisitor(creator.email, { handle: creator.handle ?? handle });
    }
  }

  return NextResponse.json({ ok: true });
}
