import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { publishedProductByHandle } from "@/lib/public";
import { sendFirstQuizStart } from "@/lib/email";
import type { QuizSessionStatus } from "@/lib/db/types";

/** Higher rank wins — a session's status never moves backwards. */
const STATUS_RANK: Record<QuizSessionStatus, number> = {
  quiz_started: 0,
  quiz_completed: 1,
  checkout: 2,
  paid: 3,
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_BODY_BYTES = 20_000;

interface TrackPayload {
  handle?: string;
  sessionId?: string;
  answers?: Record<string, string | string[]>;
  lastQuestionIdx?: number;
  status?: QuizSessionStatus;
  email?: string;
}

/**
 * Funnel tracking for public quiz visitors. Fire-and-forget from the client:
 * no session id creates a session, with one updates it. Never trusted — the
 * product is looked up by handle and answers are validated against its quiz.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "too large" }, { status: 413 });
  }
  let body: TrackPayload;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const handle = String(body.handle ?? "");
  const product = await publishedProductByHandle(handle);
  if (!product) return NextResponse.json({ error: "unknown product" }, { status: 404 });

  const admin = supabaseAdmin();

  // sanitize whatever answers were sent against the published quiz
  let answers: Record<string, string | string[]> | undefined;
  if (body.answers && typeof body.answers === "object") {
    answers = {};
    for (const q of product.questions) {
      const a = body.answers[q.id];
      const ids = Array.isArray(a) ? a : a ? [a] : [];
      const valid = ids.filter((id) => q.options.some((o) => o.id === id));
      if (!valid.length) continue;
      answers[q.id] = q.type === "multi" ? valid : valid[0];
    }
  }

  const email =
    typeof body.email === "string" && EMAIL_RE.test(body.email.trim())
      ? body.email.trim().toLowerCase()
      : undefined;

  // ---- create -------------------------------------------------------------
  if (!body.sessionId) {
    const { data: creator } = await admin
      .from("creators")
      .select("id, email, handle")
      .eq("handle", handle.toLowerCase())
      .single();
    if (!creator) return NextResponse.json({ error: "unknown creator" }, { status: 404 });

    const { data: session, error } = await admin
      .from("quiz_sessions")
      .insert({
        blueprint_id: product.blueprintId,
        creator_id: creator.id,
        answers: answers ?? {},
        last_question_idx: clampIdx(body.lastQuestionIdx, product.questions.length),
        questions_total: product.questions.length,
      })
      .select("id")
      .single();
    if (error) return NextResponse.json({ error: "insert failed" }, { status: 500 });

    // first quiz start ever → a mini-aha for the creator on the way to the sale
    if (creator.email) {
      const { error: claimErr } = await admin
        .from("lifecycle_emails")
        .insert({ creator_id: creator.id, type: "first_quiz", ref_id: "" });
      if (!claimErr) {
        await sendFirstQuizStart(creator.email, { handle: creator.handle ?? handle });
      }
    }

    return NextResponse.json({ sessionId: session.id });
  }

  // ---- update -------------------------------------------------------------
  const { data: session } = await admin
    .from("quiz_sessions")
    .select("id, blueprint_id, status")
    .eq("id", body.sessionId)
    .maybeSingle();
  if (!session || session.blueprint_id !== product.blueprintId) {
    return NextResponse.json({ error: "unknown session" }, { status: 404 });
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (answers && Object.keys(answers).length) patch.answers = answers;
  if (body.lastQuestionIdx != null) {
    patch.last_question_idx = clampIdx(body.lastQuestionIdx, product.questions.length);
  }
  if (email) patch.email = email;
  if (
    body.status &&
    body.status in STATUS_RANK &&
    STATUS_RANK[body.status] > STATUS_RANK[session.status as QuizSessionStatus]
  ) {
    patch.status = body.status;
  }

  await admin.from("quiz_sessions").update(patch).eq("id", session.id);
  return NextResponse.json({ sessionId: session.id });
}

function clampIdx(v: unknown, total: number): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0) return 0;
  return Math.min(n, total);
}
