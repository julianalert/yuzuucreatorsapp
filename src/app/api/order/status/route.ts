import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** Public: the order id (uuid) acts as the capability token. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  const { data: order } = await supabaseAdmin()
    .from("orders")
    .select("status")
    .eq("id", id)
    .maybeSingle();
  if (!order) return NextResponse.json({ error: "not found" }, { status: 404 });

  return NextResponse.json({ status: order.status });
}
