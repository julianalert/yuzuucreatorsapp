"use client";

import { useState } from "react";
import Link from "next/link";
import { dismissLaunchChecklist, recordLinkCopied, setChecklistItem } from "@/app/dashboard/actions";
import type { LaunchChecklist as LaunchChecklistState, ShareKit } from "@/lib/db/types";

const KIT_TABS = [
  { key: "caption", label: "Feed caption" },
  { key: "story_text", label: "Story text" },
  { key: "reel_script", label: "Reel script" },
] as const;

export function LaunchChecklist({
  handle,
  url,
  kit,
  checklist,
  netPerSale,
  price,
  initialDismissed,
}: {
  handle: string;
  url: string;
  kit: ShareKit;
  checklist: LaunchChecklistState;
  netPerSale: string;
  price: string;
  initialDismissed: boolean;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const [optimistic, setOptimistic] = useState<Record<string, boolean>>({});
  const [dismissed, setDismissed] = useState(initialDismissed);

  const done = (item: keyof LaunchChecklistState) => optimistic[item] ?? Boolean(checklist[item]);

  async function copy(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      return;
    }
    setCopied(key);
    setTimeout(() => setCopied((c) => (c === key ? null : c)), 2000);
    if (key === "link") {
      setOptimistic((o) => ({ ...o, link: true }));
      recordLinkCopied().catch(() => {});
    }
  }

  function toggle(item: keyof LaunchChecklistState) {
    const next = !done(item);
    setOptimistic((o) => ({ ...o, [item]: next }));
    setChecklistItem(item, next).catch(() => {});
  }

  function markComplete() {
    setDismissed(true);
    dismissLaunchChecklist().catch(() => {});
  }

  if (dismissed) return null;

  function Check({ item }: { item: keyof LaunchChecklistState }) {
    return (
      <button
        type="button"
        className={`lk-check${done(item) ? " on" : ""}`}
        role="checkbox"
        aria-checked={done(item)}
        onClick={() => toggle(item)}
      >
        <i />
      </button>
    );
  }

  const steps = [
    {
      item: "quiz" as const,
      title: "Walk your own funnel",
      body: (
        <>
          <Link href={`/u/${handle}`} target="_blank" className="btn btn-outline btn-sm">
            Open your page as a follower
          </Link>
          <p className="lk-sub">
            Take your own quiz, see the plan pitch. Your visits never count in the stats.
          </p>
        </>
      ),
    },
    {
      item: "link" as const,
      title: "Copy your link",
      body: (
        <div className="lk-copyline">
          <span className="url">{url}</span>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => copy("link", `https://${url}`)}
          >
            {copied === "link" ? "Copied" : "Copy link"}
          </button>
        </div>
      ),
    },
    {
      item: "bio" as const,
      title: "Put it in your Instagram bio",
      body: (
        <div className="lk-paste">
          <p>{kit.bio_line}</p>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => copy("bio", kit.bio_line)}
          >
            {copied === "bio" ? "Copied" : "Copy bio line"}
          </button>
        </div>
      ),
    },
    {
      item: "story" as const,
      title: "Post a story today",
      body: (
        <div className="lk-paste">
          <p style={{ whiteSpace: "pre-wrap" }}>{kit.story_text}</p>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => copy("story", kit.story_text)}
          >
            {copied === "story" ? "Copied" : "Copy story text"}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="card lk">
      <div className="lk-hd">
        <div className="lk-hd-top">
          <span className="micro">Launch checklist</span>
          <button type="button" className="btn btn-accent btn-sm" onClick={markComplete}>
            Mark as complete
          </button>
        </div>
        <h2>One post gets your first sale.</h2>
        <p className="lk-money">
          Every ${price} sale puts <b>${netPerSale}</b> in your pocket. The words are written —
          you only paste.
        </p>
      </div>

      <ol className="lk-steps">
        {steps.map((s, i) => (
          <li key={s.item} className={done(s.item) ? "done" : ""}>
            <Check item={s.item} />
            <div className="lk-step-body">
              <span className="lk-n">Step {i + 1}</span>
              <h3>{s.title}</h3>
              {s.body}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Ready-to-paste content, independent of the launch checklist above — stays
 * on screen even after the checklist is marked complete and dismissed. */
export function PasteKit({ kit }: { kit: ShareKit }) {
  const [copied, setCopied] = useState<string | null>(null);
  const [tab, setTab] = useState<(typeof KIT_TABS)[number]["key"]>("caption");

  async function copy(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      return;
    }
    setCopied(key);
    setTimeout(() => setCopied((c) => (c === key ? null : c)), 2000);
  }

  return (
    <div className="card lk-more">
      <span className="micro">Pre-made content for you to share</span>
      <div className="lk-tabs" role="tablist">
        {KIT_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={`lk-tab${tab === t.key ? " on" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="lk-paste" style={{ marginTop: 12 }}>
        <p style={{ whiteSpace: "pre-wrap" }}>{kit[tab]}</p>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => copy(tab, kit[tab])}>
          {copied === tab ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
