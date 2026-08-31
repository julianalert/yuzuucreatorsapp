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

/** Quiz state rebuilt server-side from a tracked session (recovery emails). */
export interface RestoredQuiz {
  answers: string;
  sessionId: string;
  email: string;
}

export function CheckoutClient({
  handle,
  action,
  priceUsd,
  emailError,
  payError = false,
  canceled = false,
  isPreview = false,
  restored = null,
}: {
  handle: string;
  action: (formData: FormData) => Promise<void>;
  /** List price, e.g. "27". Tax is added by Stripe on the payment page. */
  priceUsd: string;
  emailError?: boolean;
  /** Stripe session creation failed — ask them to try again. */
  payError?: boolean;
  /** They backed out of the Stripe payment page. */
  canceled?: boolean;
  /** The creator walking their own funnel — no order, no tracking. */
  isPreview?: boolean;
  restored?: RestoredQuiz | null;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const fromStorage = useStoredQuiz(handle);
  const stored = fromStorage ?? restored;

  useEffect(() => {
    if (fromStorage === null && !restored) router.replace(`/u/${handle}/quiz`);
  }, [fromStorage, restored, handle, router]);

  // funnel: they reached checkout
  const sessionId = stored?.sessionId ?? null;
  useEffect(() => {
    if (sessionId && !isPreview) trackQuizSession({ handle, sessionId, status: "checkout" });
  }, [sessionId, handle, isPreview]);

  if (!stored) {
    return <p style={{ fontSize: 14.5, color: "var(--sage)" }}>Loading your answers…</p>;
  }

  if (isPreview) {
    return (
      <div className="co-form">
        <div className="co-sec">
          <span className="micro">Payment</span>
          <div className="pay-note">
            <p>
              This is your preview — a buyer goes to a secure Stripe payment page from here.
              Walking through never creates an order or touches your stats.
            </p>
          </div>
        </div>
        <button className="btn btn-primary btn-lg btn-block" type="button" disabled>
          Pay ${priceUsd} (buyers only)
        </button>
      </div>
    );
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

      {canceled ? (
        <div className="co-sec">
          <p className="hint">
            No charge was made — your answers are still here whenever you&apos;re ready.
          </p>
        </div>
      ) : null}
      {payError ? (
        <div className="co-sec">
          <p className="hint" style={{ color: "#c96f2f" }}>
            Something went wrong starting the payment — please try again.
          </p>
        </div>
      ) : null}

      <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={submitting}>
        {submitting ? "Taking you to payment…" : `Pay $${priceUsd} securely`}
      </button>
      <p className="guarantee">
        Secure payment by Stripe. Not what you described? Reply to the delivery email within 14
        days and we&apos;ll refund you.
      </p>
    </form>
  );
}
