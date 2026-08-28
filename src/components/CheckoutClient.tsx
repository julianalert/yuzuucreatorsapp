"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { QUIZ_STORAGE_KEY } from "./QuizClient";
import { trackQuizSession } from "@/lib/quiz-tracking";

const noopSubscribe = () => () => {};

interface StoredQuiz {
  answers: string;
  sessionId: string | null;
  email: string;
}

/** Quiz state persisted by QuizClient, or null when missing/invalid. */
function useStoredQuiz(handle: string): StoredQuiz | null | undefined {
  const raw = useSyncExternalStore(
    noopSubscribe,
    () => sessionStorage.getItem(QUIZ_STORAGE_KEY),
    () => undefined // server snapshot: unknown until hydration
  );
  if (raw === undefined) return undefined;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed.handle !== handle) return null;
    return {
      answers: JSON.stringify(parsed.answers),
      sessionId: typeof parsed.sessionId === "string" ? parsed.sessionId : null,
      email: typeof parsed.email === "string" ? parsed.email : "",
    };
  } catch {
    return null;
  }
}

export function CheckoutClient({
  handle,
  action,
  emailError,
}: {
  handle: string;
  action: (formData: FormData) => Promise<void>;
  emailError?: boolean;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const stored = useStoredQuiz(handle);

  useEffect(() => {
    if (stored === null) router.replace(`/u/${handle}/quiz`);
  }, [stored, handle, router]);

  // funnel: they reached checkout
  const sessionId = stored?.sessionId ?? null;
  useEffect(() => {
    if (sessionId) trackQuizSession({ handle, sessionId, status: "checkout" });
  }, [sessionId, handle]);

  if (!stored) {
    return <p style={{ fontSize: 14.5, color: "var(--sage)" }}>Loading your answers…</p>;
  }

  return (
    <form
      className="co-form"
      action={(fd) => {
        setSubmitting(true);
        return action(fd);
      }}
    >
      <input type="hidden" name="handle" value={handle} />
      <input type="hidden" name="answers" value={stored.answers} />
      {stored.sessionId ? (
        <input type="hidden" name="session_id" value={stored.sessionId} />
      ) : null}

      <div className="co-sec">
        <span className="micro">Where we send it</span>
        <label className="form-label" htmlFor="email">
          Email
        </label>
        <div className="field">
          <input
            id="email"
            type="email"
            name="email"
            placeholder="you@example.com"
            defaultValue={stored.email}
            required
          />
        </div>
        {emailError ? (
          <p className="hint" style={{ color: "#c96f2f" }}>
            That email doesn&apos;t look right — check it and try again.
          </p>
        ) : (
          <p className="hint">Your private link arrives here as soon as your plan is written.</p>
        )}
      </div>

      <div className="co-sec">
        <span className="micro">Payment</span>
        <div className="pay-fake">
          <p>
            Payments aren&apos;t wired up yet — clicking Pay now generates your plan immediately,
            free. Stripe goes in before launch.
          </p>
        </div>
      </div>

      <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={submitting}>
        {submitting ? "Starting your plan…" : "Pay now"}
      </button>
      <p className="guarantee">
        If the plan doesn&apos;t fit your situation, reply to the delivery email within 14 days
        for a full refund.
      </p>
    </form>
  );
}
