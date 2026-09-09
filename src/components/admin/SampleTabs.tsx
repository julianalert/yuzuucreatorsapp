"use client";

import { useState } from "react";
import { PlanDocument } from "@/components/plan/PlanDocument";
import type { SampleView } from "@/components/SampleReview";
import type { OutputTemplate } from "@/lib/blueprint/types";

/**
 * The three sample plans, read-only.
 *
 * SampleReview does the same job for the creator but requires an approve or
 * reject action — the whole point of that screen. An admin looking at a spec
 * build is judging quality before pitching, and must not be able to approve on
 * a creator's behalf, so this drops the decision entirely rather than passing
 * a no-op action.
 */
export function SampleTabs({
  samples,
  template,
  creatorName,
}: {
  samples: SampleView[];
  template: OutputTemplate;
  creatorName: string;
}) {
  const [tab, setTab] = useState(0);
  const sample = samples[tab];
  if (!sample) return null;

  return (
    <>
      <div className="sample-switch" role="tablist" aria-label="Sample buyer">
        {samples.map((s, i) => (
          <button
            key={s.persona}
            type="button"
            role="tab"
            aria-selected={i === tab}
            className={`sample-tab ${i === tab ? "on" : ""}`}
            onClick={() => setTab(i)}
          >
            <span className="sample-tab-n">{i + 1}</span>
            <span className="sample-tab-label">{s.label}</span>
          </button>
        ))}
      </div>
      <div style={{ marginTop: 18 }}>
        <span className="micro">
          An invented buyer — this is the exact document they&apos;d receive
        </span>
      </div>
      <div style={{ marginTop: 14 }}>
        <PlanDocument template={template} output={sample.output} creatorName={creatorName} />
      </div>
    </>
  );
}
