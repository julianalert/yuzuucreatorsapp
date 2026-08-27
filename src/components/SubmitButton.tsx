"use client";

import { useFormStatus } from "react-dom";

/**
 * Submit button for a `<form action={...}>` that swaps itself for a spinner
 * while the action is running. Server actions with real latency (a fetch, a
 * DB write, a redirect) otherwise leave the UI looking frozen after click.
 */
export function SubmitButton({
  label,
  pendingLabel,
  hint,
  className = "btn btn-primary btn-lg",
}: {
  label: string;
  pendingLabel: string;
  hint?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();

  if (pending) {
    return (
      <span className="btn-pending" role="status" aria-live="polite">
        <span className="spinner" aria-hidden="true" />
        {pendingLabel}
      </span>
    );
  }

  return (
    <>
      <button className={className} type="submit">
        {label}
      </button>
      {hint ? <span style={{ fontSize: 13.5, color: "var(--sage)" }}>{hint}</span> : null}
    </>
  );
}
