"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface StageItem {
  label: string;
  /** builds.stage values that mean this item is the one running */
  stages: string[];
}

/** Friendly stage lists per phase — the dots reflect real pipeline stages. */
const PHASES: Record<"scan" | "build", StageItem[]> = {
  scan: [
    { label: "Profile and bio", stages: [] },
    { label: "Your recent posts", stages: [] },
    { label: "Comments on your most-discussed posts", stages: ["scrape"] },
    { label: "What your audience keeps asking for", stages: ["extract"] },
    { label: "Product ideas that fit", stages: ["propose"] },
  ],
  build: [
    { label: "Researching the subject", stages: ["knowledge"] },
    { label: "Designing your document", stages: ["template", "prompt"] },
    { label: "Writing the quiz", stages: ["quiz"] },
    { label: "Writing plans for three sample buyers", stages: ["samples"] },
    { label: "Checking they're genuinely personal", stages: ["swap_test", "critique"] },
    { label: "Samples for you to read", stages: ["gate", "publish"] },
  ],
};

const ROUTE_FOR_STATUS: Record<string, string> = {
  awaiting_topic: "/onboard/ideas",
  awaiting_approval: "/onboard/review",
  complete: "/dashboard",
  declined: "/onboard",
  failed: "/onboard",
};

export function BuildProgress({
  buildId,
  phase,
  initialStage,
  initialStatus,
}: {
  buildId: string;
  phase: "scan" | "build";
  initialStage: string | null;
  initialStatus: string;
}) {
  const router = useRouter();
  const [stage, setStage] = useState(initialStage);
  const items = PHASES[phase];

  useEffect(() => {
    let stopped = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/build/status?id=${buildId}`, { cache: "no-store" });
        if (res.status === 401) {
          // session died mid-build — send them to sign back in, then straight back here
          router.push(`/auth?next=${encodeURIComponent(window.location.pathname)}`);
          return;
        }
        if (!res.ok) return;
        const data: { status: string; stage: string | null } = await res.json();
        if (stopped) return;
        setStage(data.stage);
        const route = ROUTE_FOR_STATUS[data.status];
        if (route) {
          router.push(route);
          return;
        }
        // still running — did it move to the other phase?
        const scanStages = ["scrape", "extract", "propose"];
        const inScan = scanStages.includes(data.stage ?? "scrape");
        if (phase === "scan" && !inScan) router.push("/onboard/building");
        if (phase === "build" && inScan) router.push("/onboard/scanning");
      } catch {
        // transient — next tick retries
      }
    };
    const interval = setInterval(tick, 2500);
    tick();
    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [buildId, phase, router]);

  // index of the item currently running
  let nowIdx = items.findIndex((it) => it.stages.includes(stage ?? ""));
  if (nowIdx === -1) nowIdx = initialStatus === "queued" ? 0 : 0;

  return (
    <div style={{ marginTop: 34 }}>
      <div className="live-status" role="status" aria-live="polite">
        <span className="spinner" aria-hidden="true" />
        Working — this updates automatically
      </div>
      <ul className="stages" style={{ marginTop: 18 }}>
        {items.map((it, i) => {
          const cls = i < nowIdx ? "done" : i === nowIdx ? "now" : "";
          return (
            <li key={it.label} className={cls}>
              <span className="dot" />
              <span>{it.label}</span>
              <span className="t">{i < nowIdx ? "✓" : "—"}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
