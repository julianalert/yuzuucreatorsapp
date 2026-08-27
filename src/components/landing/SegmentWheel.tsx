"use client";

import { useEffect, useRef, useState } from "react";

const SEGS: [string, string][] = [
  ["the 2am waker", "\u201cYou're not a bad sleeper. You fall asleep at a body temperature that's too high, so your first deep block ends early — and once it ends, the smallest noise ends the night.\u201d"],
  ["the wired-but-tired", "\u201cYou're exhausted at 9pm and awake at 11. That gap is the problem, and it isn't willpower — it's a second cortisol wave you're walking straight into every evening.\u201d"],
  ["the shift rotator", "\u201cYour body never gets to pick a curve. So we stop chasing a bedtime and build one fixed anchor that survives every rota change.\u201d"],
  ["the new parent", "\u201cYou don't need eight hours. You need your two blocks to land in the right places, and right now they're both landing in the wrong one.\u201d"],
  ["the phone spiraller", "\u201cThe phone isn't keeping you up because of blue light. It's keeping you up because it's the only part of your day nobody asks anything of you.\u201d"],
  ["the early riser", "\u201cYou wake at 4:40 and can't get back. That's not insomnia — it's a sleep window that has drifted two hours earlier than your life.\u201d"],
  ["the melatonin dependent", "\u201cComing off it cold is why the last three attempts failed. The taper matters more than the decision.\u201d"],
  ["the anxious sleeper", "\u201cYour body is fine. It's the ten minutes before lights-out that decide the night, and those ten minutes currently have no shape.\u201d"],
  ["the weekend swinger", "\u201cTwo late nights on Saturday cost you until Wednesday. We're not banning them — we're paying for them differently.\u201d"],
  ["the light sleeper", "\u201cEvery environmental fix you've tried treats the symptom. Your arousal threshold is the actual dial, and it's set by the four hours before bed.\u201d"],
  ["the snorer's partner", "\u201cYou're solving someone else's sleep problem with your own sleep. We start by separating the two.\u201d"],
  ["the perimenopausal waker", "\u201cThe 3am wake isn't random. It tracks a temperature drop your body used to handle silently and no longer does.\u201d"],
  ["the caffeine denier", "\u201cYour last coffee is at 2pm and you swear it doesn't affect you. Half of it is still in you at 8. That's not a personality trait, it's a half-life.\u201d"],
  ["the chronic under-sleeper", "\u201cYou've decided six hours is enough because you've never had a run of eight. We're going to test that claim for fourteen days.\u201d"],
];

const TONES = ["#E8D82B", "#F1E560", "#DCCB1E", "#F6EB6B"];

function segPath(i: number, n: number): string {
  const cx = 160, cy = 160, R = 152, r = 92, gap = 1.1;
  const a0 = ((i * 360) / n - 90 + gap) * (Math.PI / 180);
  const a1 = (((i + 1) * 360) / n - 90 - gap) * (Math.PI / 180);
  // rounded to avoid server/client float precision hydration mismatches
  const p = (rad: number, ang: number) => [
    Number((cx + rad * Math.cos(ang)).toFixed(2)),
    Number((cy + rad * Math.sin(ang)).toFixed(2)),
  ];
  const [x1, y1] = p(R, a0);
  const [x2, y2] = p(R, a1);
  const [x3, y3] = p(r, a1);
  const [x4, y4] = p(r, a0);
  return `M${x1} ${y1} A${R} ${R} 0 0 1 ${x2} ${y2} L${x3} ${y3} A${r} ${r} 0 0 0 ${x4} ${y4} Z`;
}

export function SegmentWheel() {
  const [cur, setCur] = useState(0);
  const auto = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduce) {
      auto.current = setInterval(() => setCur((c) => (c + 1) % SEGS.length), 2600);
    }
    return () => {
      if (auto.current) clearInterval(auto.current);
    };
  }, []);

  function pick(i: number) {
    if (auto.current) {
      clearInterval(auto.current);
      auto.current = null;
    }
    setCur(i);
  }

  return (
    <div className="wheel-block">
      <div className="wheel">
        <svg viewBox="0 0 320 320" role="img" aria-label="Fourteen buyer segments">
          {SEGS.map((_, i) => (
            <path
              key={i}
              className="seg"
              d={segPath(i, SEGS.length)}
              fill={TONES[i % 4]}
              stroke="#0F1F17"
              strokeWidth="1"
              opacity={i === cur ? 1 : 0.32}
              onMouseEnter={() => pick(i)}
              onClick={() => pick(i)}
            />
          ))}
        </svg>
        <div className="core">
          <div>
            <div className="cn">segments</div>
            <div className="cv">{String(cur + 1).padStart(2, "0")}</div>
          </div>
        </div>
      </div>
      <div className="seg-read">
        <span className="who">
          segment {String(cur + 1).padStart(2, "0")} — {SEGS[cur][0]}
        </span>
        <p className="say">{SEGS[cur][1]}</p>
        <div className="foot">opening paragraph · differs completely across all 14</div>
      </div>
    </div>
  );
}
