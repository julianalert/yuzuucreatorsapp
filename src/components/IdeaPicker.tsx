"use client";

import { useState } from "react";
import type { TopicProposal } from "@/lib/blueprint/types";

const SCORE_LABELS: [keyof TopicProposal["scores"], string][] = [
  ["acuteness", "Urgency"],
  ["segmentability", "Fits different people"],
  ["resolvability", "Fixable in the timeframe"],
  ["credibility", "You're credible"],
];

export function IdeaPicker({
  proposals,
  buildId,
  action,
}: {
  proposals: TopicProposal[];
  buildId: string;
  action: (formData: FormData) => Promise<void>;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  return (
    <form
      action={(fd) => {
        setSubmitting(true);
        return action(fd);
      }}
    >
      <input type="hidden" name="build_id" value={buildId} />
      <input type="hidden" name="topic_index" value={selected ?? ""} />

      <div className="ideas">
        {proposals.map((p, i) => (
          <button
            key={i}
            type="button"
            className="idea"
            role="radio"
            aria-checked={selected === i}
            onClick={() => setSelected(i)}
          >
            <span className="tick">
              <i />
            </span>
            <span>
              <h3>{p.topic_title}</h3>
              <span className="promise">{p.promise}</span>
              <span className="who-chips">
                {p.bonus ? (
                  <span className="chip chip-bonus">Wild card</span>
                ) : null}
                {p.duration_days ? (
                  <span className="chip">{p.duration_days}-day plan</span>
                ) : p.bonus ? null : (
                  <span className="chip">30-day plan</span>
                )}
                {(p.segmentation_preview ?? []).slice(0, 4).map((w) => (
                  <span key={w} className="chip">
                    {w}
                  </span>
                ))}
              </span>
              <span className="scores">
                {SCORE_LABELS.map(([key, label]) => {
                  const v = p.scores?.[key] ?? 0;
                  return (
                    <span key={key} className="score">
                      <span className="k">{label}</span>
                      <span className="v">
                        <b>{v}</b>
                        <span>
                          <i style={{ width: `${v * 10}%` }} />
                        </span>
                      </span>
                    </span>
                  );
                })}
              </span>
            </span>
          </button>
        ))}
      </div>

      <div style={{ marginTop: 30, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <button
          className="btn btn-primary btn-lg"
          type="submit"
          disabled={selected === null || submitting}
        >
          {submitting ? "Starting the build…" : "Build this product"}
        </button>
        <a className="btn btn-ghost" href="/onboard?new=1">
          None of these fit
        </a>
      </div>
    </form>
  );
}
