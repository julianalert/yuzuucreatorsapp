"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { QUIZ_STORAGE_KEY } from "./QuizClient";

const noopSubscribe = () => () => {};

/** Quiz answers persisted by QuizClient, or null when missing/invalid. */
function useStoredAnswers(handle: string): string | null | undefined {
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
    return JSON.stringify(parsed.answers);
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
  const answers = useStoredAnswers(handle);

  useEffect(() => {
    if (answers === null) router.replace(`/u/${handle}/quiz`);
  }, [answers, handle, router]);

  if (!answers) {
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
      <input type="hidden" name="answers" value={answers} />

      <div className="co-sec">
        <span className="micro">Where we send it</span>
        <label className="form-label" htmlFor="email">
          Email
        </label>
        <div className="field">
          <input id="email" type="email" name="email" placeholder="you@example.com" required />
        </div>
        {emailError ? (
          <p className="hint" style={{ color: "#c96f2f" }}>
            That email doesn&apos;t look right — check it and try again.
          </p>
        ) : (
          <p className="hint">Your plan arrives here as a PDF, plus a link to the web version.</p>
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
        If the plan doesn&apos;t fit your situation, reply to the delivery email within 14 days for
        a full refund.
      </p>
    </form>
  );
}
