"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const STEPS = [
  "Reading your answers",
  "Working out what's going on for you",
  "Writing your plan, section by section",
  "Checking it against the quality bar",
  "Publishing your private page",
];

/** paid and generating render the same screen — don't refresh between them. */
function group(status: string): string {
  return status === "paid" || status === "generating" ? "generating" : status;
}

export function OrderPoller({
  orderId,
  mode = "generating",
}: {
  orderId: string;
  /** "confirming": waiting for the Stripe webhook to mark the order paid. */
  mode?: "generating" | "confirming";
}) {
  const router = useRouter();
  const [tickCount, setTickCount] = useState(0);

  useEffect(() => {
    const rendered = mode === "confirming" ? "pending_payment" : "generating";
    const interval = setInterval(async () => {
      setTickCount((c) => c + 1);
      try {
        const res = await fetch(`/api/order/status?id=${orderId}`, { cache: "no-store" });
        if (!res.ok) return;
        const { status } = await res.json();
        if (group(status) !== rendered) router.refresh();
      } catch {
        // transient — next tick retries
      }
    }, 2500);
    return () => clearInterval(interval);
  }, [orderId, mode, router]);

  if (mode === "confirming") {
    return (
      <div className="live-status" role="status" aria-live="polite" style={{ marginTop: 30 }}>
        <span className="spinner" aria-hidden="true" />
        Confirming your payment — a few seconds
      </div>
    );
  }

  // purely cosmetic pacing — real state comes from the poll above
  const nowIdx = Math.min(Math.floor(tickCount / 3), STEPS.length - 1);

  return (
    <ul className="stages" style={{ marginTop: 30 }}>
      {STEPS.map((label, i) => (
        <li key={label} className={i < nowIdx ? "done" : i === nowIdx ? "now" : ""}>
          <span className="dot" />
          <span>{label}</span>
          <span className="t">{i < nowIdx ? "✓" : "—"}</span>
        </li>
      ))}
    </ul>
  );
}
