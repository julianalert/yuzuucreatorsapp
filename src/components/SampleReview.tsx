"use client";

import { useState } from "react";

export interface SampleView {
  archetype: string;
  label: string;
  sections: { title: string; prose: string }[];
}

export function SampleReview({
  samples,
  buildId,
  handle,
  action,
}: {
  samples: SampleView[];
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
      <div className="tabs">
        {samples.map((s, i) => (
          <button key={s.archetype} className={`tab ${i === tab ? "on" : ""}`} onClick={() => setTab(i)}>
            {s.label}
          </button>
        ))}
      </div>
      <div className="paper">
        <span className="micro">
          Sample {tab + 1} of {samples.length} · what this buyer would receive
        </span>
        {sample?.sections.map((sec) => (
          <div key={sec.title} style={{ marginBottom: 28 }}>
            <h3>{sec.title}</h3>
            {sec.prose
              .split(/\n{2,}/)
              .map((p) => p.trim())
              .filter(Boolean)
              .map((p, i) => (
                <p key={i}>{p}</p>
              ))}
          </div>
        ))}
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
