"use client";

import { useSyncExternalStore } from "react";
import { QUIZ_STORAGE_KEY } from "./QuizClient";
import type { PublicQuizQuestion } from "@/lib/public";

const noopSubscribe = () => () => {};

/**
 * The "what you told us" card on the pre-checkout page — mirrors the buyer's
 * actual quiz answers back at them so the purchase feels (and is) personal.
 * Answers live in sessionStorage, so this must render client-side.
 */
export function CheckoutSummary({
  handle,
  questions,
}: {
  handle: string;
  questions: PublicQuizQuestion[];
}) {
  const raw = useSyncExternalStore(
    noopSubscribe,
    () => sessionStorage.getItem(QUIZ_STORAGE_KEY),
    () => undefined
  );
  if (raw === undefined || !raw) return null;

  let answers: Record<string, string | string[]>;
  try {
    const parsed = JSON.parse(raw);
    if (parsed.handle !== handle) return null;
    answers = parsed.answers ?? {};
  } catch {
    return null;
  }

  const picked: string[] = [];
  for (const q of questions) {
    const a = answers[q.id];
    const ids = Array.isArray(a) ? a : a ? [a] : [];
    for (const id of ids) {
      const opt = q.options.find((o) => o.id === id);
      if (opt) picked.push(opt.label);
    }
  }
  if (!picked.length) return null;

  return (
    <div className="co-brief">
      <span className="micro">What you told us</span>
      <h2>Your plan starts from here.</h2>
      <p className="note">
        Every section is written from these answers — the diagnosis, the pacing, and what we skip.
      </p>
      <div className="co-chips">
        {picked.map((label) => (
          <span key={label} className="co-chip">
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
