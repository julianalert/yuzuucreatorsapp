"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const STEPS = [
  "Reading your answers",
  "Working out your starting point",
  "Writing your plan, section by section",
  "Checking it against the quality bar",
  "Assembling the PDF",
];

export function OrderPoller({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [tickCount, setTickCount] = useState(0);

  useEffect(() => {
    const interval = setInterval(async () => {
      setTickCount((c) => c + 1);
      try {
        const res = await fetch(`/api/order/status?id=${orderId}`, { cache: "no-store" });
        if (!res.ok) return;
        const { status } = await res.json();
        if (status === "delivered" || status === "failed") {
          router.refresh();
        }
      } catch {
        // transient — next tick retries
      }
    }, 2500);
    return () => clearInterval(interval);
  }, [orderId, router]);

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
