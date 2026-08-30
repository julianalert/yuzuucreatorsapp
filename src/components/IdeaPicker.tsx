"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import type { TopicProposal } from "@/lib/blueprint/types";

const SCORE_LABELS: [keyof TopicProposal["scores"], string][] = [
  ["acuteness", "Urgency"],
  ["segmentability", "Fits different people"],
  ["credibility", "You're credible"],
];

type SubmitIntent = "build" | "regen" | "discard";

const PENDING_LABELS: Record<SubmitIntent, string> = {
  build: "Starting building…",
  regen: "Rethinking…",
  discard: "Clearing…",
};

function IdeaPickerActions({
  selected,
  regenOpen,
  setRegenOpen,
  regenerateAction,
  discardAction,
}: {
  selected: number | null;
  regenOpen: boolean;
  setRegenOpen: (open: boolean) => void;
  regenerateAction: (formData: FormData) => Promise<void>;
  discardAction: (formData: FormData) => Promise<void>;
}) {
  const { pending } = useFormStatus();
  const [intent, setIntent] = useState<SubmitIntent | null>(null);

  if (pending && intent) {
    return (
      <div style={{ marginTop: 30 }}>
        <span className="btn-pending" role="status" aria-live="polite">
          <span className="spinner" aria-hidden="true" />
          {PENDING_LABELS[intent]}
        </span>
      </div>
    );
  }

  return (
    <>
      <div style={{ marginTop: 30, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <button
          className="btn btn-primary btn-lg"
          type="submit"
          disabled={selected === null}
          onClick={() => setIntent("build")}
        >
          Build this product
        </button>
        {!regenOpen ? (
          <button className="btn btn-ghost" type="button" onClick={() => setRegenOpen(true)}>
            None of these fit
          </button>
        ) : null}
      </div>

      {regenOpen ? (
        <div className="card" style={{ marginTop: 22 }}>
          <label className="form-label" htmlFor="regen_reason">
            What&apos;s off about them?
          </label>
          <textarea
            className="area"
            id="regen_reason"
            name="regen_reason"
            rows={2}
            placeholder="Optional, but it sharpens the next batch — e.g. Too beginner-focused, my audience is mostly advanced."
          />
          <div style={{ marginTop: 14, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
            <button
              className="btn btn-outline"
              type="submit"
              formAction={regenerateAction}
              onClick={() => setIntent("regen")}
            >
              Get different ideas
            </button>
            <button
              className="btn btn-ghost"
              type="submit"
              formAction={discardAction}
              onClick={() => setIntent("discard")}
            >
              Start over from scratch
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function IdeaPicker({
  proposals,
  buildId,
  priceUsd,
  keepUsd,
  action,
  regenerateAction,
  discardAction,
}: {
  proposals: TopicProposal[];
  buildId: string;
  priceUsd: string;
  keepUsd: string;
  action: (formData: FormData) => Promise<void>;
  regenerateAction: (formData: FormData) => Promise<void>;
  discardAction: (formData: FormData) => Promise<void>;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [regenOpen, setRegenOpen] = useState(false);

  return (
    <form action={action}>
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
              {p.bonus ? (
                <span
                  className="chip chip-bonus"
                  style={{ display: "inline-block", marginBottom: 10 }}
                >
                  Wild card
                </span>
              ) : null}
              <h3>{p.topic_title}</h3>
              <span className="promise">{p.promise}</span>
              <span className="idea-money">
                ${priceUsd} per sale — <b>${keepUsd} goes to you</b>
              </span>
              {p.why_this_works ? <span className="idea-why">{p.why_this_works}</span> : null}
              {p.segmentation_preview?.length ? (
                <span className="who-group">
                  <span className="who-label">Works for</span>
                  <span className="who-chips">
                    {p.segmentation_preview.slice(0, 4).map((w) => (
                      <span key={w} className="chip">
                        {w}
                      </span>
                    ))}
                  </span>
                </span>
              ) : null}
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

      <IdeaPickerActions
        selected={selected}
        regenOpen={regenOpen}
        setRegenOpen={setRegenOpen}
        regenerateAction={regenerateAction}
        discardAction={discardAction}
      />
    </form>
  );
}
