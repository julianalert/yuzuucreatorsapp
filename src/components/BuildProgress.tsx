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
    { label: "Samples for you to read", stages: ["gate"] },
    { label: "Going live", stages: ["publish"] },
  ],
};

const ROUTE_FOR_STATUS: Record<string, string> = {
  awaiting_topic: "/onboard/ideas",
  awaiting_approval: "/onboard/review",
  // the transition from "publishing" to "live" is the launch moment —
  // ?published=1 turns the dashboard into the launch screen
  complete: "/dashboard?published=1",
  declined: "/onboard",
  failed: "/onboard",
};

/** Pre-signup builds live on /start; declines land back on the homepage with
 * the halt reason, since there's no /onboard to explain it. */
function guestRouteFor(status: string, haltedAt: string | null): string | null {
  if (status === "awaiting_topic") return "/start/ideas";
  if (status === "declined" || status === "failed") {
    return `/?error=${encodeURIComponent(haltedAt ?? status)}`;
  }
  return ROUTE_FOR_STATUS[status] ?? null;
}

export function BuildProgress({
  buildId,
  phase,
  initialStage,
  initialStatus,
  guest = false,
}: {
  buildId: string;
  phase: "scan" | "build";
  initialStage: string | null;
  initialStatus: string;
  /** Anonymous pre-signup build: routes stay on /start and errors go home. */
  guest?: boolean;
}) {
  const router = useRouter();
  const [stage, setStage] = useState(initialStage);
  const items = PHASES[phase];

  useEffect(() => {
    let stopped = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/build/status?id=${buildId}`, { cache: "no-store" });
        if (res.status === 401 || (guest && res.status === 404)) {
          // guests: cookie died (or the build was claimed in another tab) —
          // creators: session died mid-build, sign back in and come straight back
          router.push(
            guest ? "/" : `/auth?next=${encodeURIComponent(window.location.pathname)}`
          );
          return;
        }
        if (!res.ok) return;
        const data: { status: string; stage: string | null; halted_at: string | null } =
          await res.json();
        if (stopped) return;
        setStage(data.stage);
        const route = guest
          ? guestRouteFor(data.status, data.halted_at)
          : ROUTE_FOR_STATUS[data.status];
        if (route) {
          router.push(route);
          return;
        }
        // still running — did it move to the other phase? (a guest build past
        // the scan phase means it was claimed: the creator flow owns it now)
        const scanStages = ["scrape", "extract", "propose"];
        const inScan = scanStages.includes(data.stage ?? "scrape");
        if (phase === "scan" && !inScan) router.push("/onboard/building");
        if (phase === "build" && inScan) router.push("/onboard/scanning");
      } catch {
        // transient — next tick retries
      }
    };
    // scan is short and the redirect to ideas should feel instant; build runs
    // for many minutes with slow stage changes, so poll far less often
    const interval = setInterval(tick, phase === "scan" ? 3000 : 12000);
    tick();
    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [buildId, phase, router, guest]);

  // index of the item currently running
  let nowIdx = items.findIndex((it) => it.stages.includes(stage ?? ""));
  if (nowIdx === -1) nowIdx = initialStatus === "queued" ? 0 : 0;
  const pct = Math.min(100, Math.max(6, Math.round(((nowIdx + 0.5) / items.length) * 100)));

  return (
    <div style={{ marginTop: 34 }}>
      <div className="live-status" role="status" aria-live="polite">
        <span className="spinner" aria-hidden="true" />
        {phase === "build"
          ? "Building your complete product"
          : "Working, analyzing your audience and their needs"}
      </div>
      <div
        className="progress-bar"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
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
