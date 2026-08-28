/**
 * Client-side helper for the quiz funnel. Every call is fire-and-forget:
 * tracking must never block or break the quiz, so errors are swallowed and
 * requests use keepalive to survive navigation.
 */

import type { QuizSessionStatus } from "./db/types";

export interface QuizTrackPayload {
  handle: string;
  sessionId?: string;
  answers?: Record<string, string | string[]>;
  lastQuestionIdx?: number;
  status?: QuizSessionStatus;
  email?: string;
}

/** Returns the session id (echoed back, or freshly created), or null on failure. */
export async function trackQuizSession(payload: QuizTrackPayload): Promise<string | null> {
  try {
    const res = await fetch("/api/quiz-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { sessionId?: string };
    return data.sessionId ?? null;
  } catch {
    return null;
  }
}
