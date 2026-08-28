"use client";

import { useState } from "react";
import { PlanDocument } from "./plan/PlanDocument";
import type { GeneratedOutput, OutputTemplate } from "@/lib/blueprint/types";

export interface SampleView {
  persona: string;
  label: string;
  output: GeneratedOutput;
}

export function SampleReview({
  samples,
  template,
  creatorName,
  buildId,
  handle,
  action,
}: {
  samples: SampleView[];
  template: OutputTemplate;
  creatorName: string;
  buildId: string;
  handle: string;
  action: (formData: FormData) => Promise<void>;
}) {
  const [tab, setTab] = useState(0);
  const [rejecting, setRejecting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const sample = samples[tab];

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
        {sample ? (
          <div className="sample-doc">
            <PlanDocument template={template} output={sample.output} creatorName={creatorName} />
          </div>
        ) : null}
      </div>

      <form
        action={(fd) => {
          setSubmitting(true);
          return action(fd);
        }}
      >
        <input type="hidden" name="build_id" value={buildId} />
        {!rejecting ? (
          <div className="actions">
            <button
              className="btn btn-primary btn-lg"
              type="submit"
              name="decision"
              value="approve"
              disabled={submitting}
            >
              {submitting ? "Publishing…" : "Approve and publish"}
            </button>
            <button
              className="btn btn-outline"
              type="button"
              onClick={() => setRejecting(true)}
              disabled={submitting}
            >
              Request changes
            </button>
            <span style={{ fontSize: 13.5, color: "var(--sage)" }}>
              Publishing puts this at yuzuu.co/u/{handle}
            </span>
          </div>
        ) : (
          <div style={{ marginTop: 24 }}>
            <label className="form-label" htmlFor="reason">
              What doesn&apos;t sound like you?
            </label>
            <textarea
              className="area"
              id="reason"
              name="reason"
              rows={3}
              placeholder="Be specific — this feeds the rebuild. e.g. Too clinical, I never say 'protocol'. The week 1 advice is something I'd never recommend."
              required
            />
            <div className="actions">
              <button
                className="btn btn-primary"
                type="submit"
                name="decision"
                value="reject"
                disabled={submitting}
              >
                {submitting ? "Sending…" : "Reject and rebuild"}
              </button>
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => setRejecting(false)}
                disabled={submitting}
              >
                Back
              </button>
            </div>
          </div>
        )}
      </form>
    </>
  );
}
