"use client";

import { useEffect, useRef, useState } from "react";

interface Topic {
  t: string;
  p: string;
  w: string;
  pr: string;
}

const DATA: Record<string, { read: string[]; topics: Topic[] }> = {
  "@sleepwithmarie": {
    read: [
      "47 captions, 1,240 comments",
      "asked about waking at 3am 61 times",
      "vocabulary: wired, spiralling, sleep debt",
    ],
    topics: [
      { t: "The 30-Day Wake-Up Reset", p: "Stop waking at 3am, in 30 days.", w: "Your single most-asked question, 61 times in 90 days.", pr: "30-day plan · $27" },
      { t: "The Shift Worker's Sleep Fix", p: "Sleep properly on a rotating schedule.", w: "18% of your commenters mention shifts. Nobody serves them.", pr: "21-day plan · $27" },
      { t: "Off The Melatonin", p: "A 6-week taper that doesn't backfire.", w: "High intent, high objection. Better second product than first.", pr: "6-week plan · $37" },
    ],
  },
  "@coachdanreps": {
    read: [
      "62 captions, 2,980 comments",
      "asked about plateaus 44 times",
      "vocabulary: stalled, junk volume, deload",
    ],
    topics: [
      { t: "The 8-Week Plateau Break", p: "Add weight to a lift that's been stuck for months.", w: "Your comments are 40% 'I'm stuck at X kg'.", pr: "8-week plan · $37" },
      { t: "Train Around The Injury", p: "Keep training with a bad shoulder or knee.", w: "Highest-emotion questions you get, and the least answered.", pr: "30-day plan · $27" },
      { t: "The Home Gym Rebuild", p: "Real programming with three pieces of kit.", w: "Wide appeal, weaker personalization. Lowest of the three.", pr: "6-week plan · $27" },
    ],
  },
  "@thegutrd": {
    read: [
      "38 captions, 1,610 comments",
      "asked about bloating 73 times",
      "vocabulary: flare, trigger, reintroduce",
    ],
    topics: [
      { t: "The 21-Day Bloat Protocol", p: "Find your triggers without cutting out everything.", w: "73 mentions. It's the only thing they ask you.", pr: "21-day plan · $27" },
      { t: "The Reintroduction Plan", p: "Get foods back after an elimination diet.", w: "Your audience is already mid-elimination. Perfect timing.", pr: "6-week plan · $37" },
      { t: "Eating Out Without The Flare", p: "Restaurant strategy for a sensitive gut.", w: "Charming, but too small to carry a full product.", pr: "14-day guide · $17" },
    ],
  },
};

interface Line {
  tag: string;
  text: string;
  done?: boolean;
}

export function BuildConsole() {
  const [handle, setHandle] = useState("@sleepwithmarie");
  const [lines, setLines] = useState<Line[]>([]);
  const [topics, setTopics] = useState<Topic[] | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  function run(h?: string) {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setLines([]);
    setTopics(null);
    const key = (h ?? handle).trim() || "@yourhandle";
    const d = DATA[key] ?? DATA["@sleepwithmarie"];
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const gap = reduce ? 0 : 520;

    const steps: (() => void)[] = [
      () => setLines((l) => [...l, { tag: "read", text: `${key} — ${d.read[0]}` }]),
      () => setLines((l) => [...l, { tag: "learn", text: d.read[1] }]),
      () => setLines((l) => [...l, { tag: "learn", text: d.read[2] }]),
      () => setLines((l) => [...l, { tag: "done", text: "3 product topics, ranked by fit", done: true }]),
      () => setTopics(d.topics),
    ];
    steps.forEach((fn, i) => timers.current.push(setTimeout(fn, i * gap)));
  }

  useEffect(() => {
    const t = setTimeout(() => run(), 600);
    return () => {
      clearTimeout(t);
      timers.current.forEach(clearTimeout);
    };
    // run only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="machine">
      <div className="machine-bar">
        <span className="dot" /> build console <span style={{ marginLeft: "auto" }}>demo</span>
      </div>
      <div className="machine-body">
        <div className="input-row">
          <input
            type="text"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && run()}
            aria-label="Instagram handle"
            spellCheck={false}
          />
          <button className="btn yuzu" onClick={() => run()}>
            Build
          </button>
        </div>
        <div className="chips">
          {Object.keys(DATA).map((h) => (
            <button
              key={h}
              className="chip"
              onClick={() => {
                setHandle(h);
                run(h);
              }}
            >
              {h}
            </button>
          ))}
        </div>
        <div className="console" aria-live="polite">
          {lines.map((ln, i) => (
            <div className="ln" key={i}>
              <span className={`tag ${ln.done ? "done" : ""}`}>{ln.tag}</span>
              <span>{ln.text}</span>
            </div>
          ))}
          {topics ? (
            <>
              <div className="topics">
                {topics.map((t, i) => (
                  <div className="topic" key={t.t} style={{ animationDelay: `${i * 110}ms` }}>
                    <div className="t-top">
                      <h4>{t.t}</h4>
                      <span className="price">{t.pr}</span>
                    </div>
                    <p>{t.p}</p>
                    <span className="why">why this — {t.w}</span>
                  </div>
                ))}
              </div>
              <div className="pick">you pick one · or ask for three more</div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
