"use client";

import { useCallback, useEffect, useState } from "react";
import { CREATOR_KEEP_PCT } from "@/lib/seo";
import { LiveHandle } from "./HandleSync";

/** Everything the demo says, in one place — swap this block to demo a
 * different niche without touching the layout below. */
const DEMO = {
  handle: "refurbishedish",
  creator: "Mia | Furniture Flips & Rescues",
  product: "Your First Flip, Start to Sold",
  price: 27,
  questions: 11,
  days: 21,
};

const CREATOR_CUT = ((DEMO.price * CREATOR_KEEP_PCT) / 100).toFixed(2);

const TABS = [
  { num: "01", label: "Your profile page" },
  { num: "02", label: "Your quiz" },
  { num: "03", label: `Your checkout · you keep ${CREATOR_KEEP_PCT}%` },
  { num: "04", label: "What they walk away with" },
];

const ADVANCE_MS = 5200;

export function HeroShowcase() {
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(true);

  useEffect(() => {
    if (!auto) return;
    const t = setInterval(() => setActive((i) => (i + 1) % TABS.length), ADVANCE_MS);
    return () => clearInterval(t);
  }, [auto]);

  // A click means the visitor is driving now — stop rotating under them.
  const pick = useCallback((i: number) => {
    setAuto(false);
    setActive(i);
  }, []);

  return (
    <div className="showcase">
      <div className="sc-tabs" role="tablist" aria-label="What Yuzuu builds for you">
        {TABS.map((tab, i) => (
          <button
            key={tab.num}
            type="button"
            role="tab"
            id={`sc-tab-${i}`}
            aria-selected={active === i}
            aria-controls={`sc-panel-${i}`}
            className={`sc-tab${active === i ? " is-on" : ""}`}
            onClick={() => pick(i)}
          >
            <span className="sc-rule" />
            <span className="sc-num">{tab.num}</span>
            <span className="sc-label">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="sc-frame">
        <div className="sc-bar">
          <span className="sc-pip" />
          <span className="sc-pip" />
          <span className="sc-pip" />
          <span className="sc-url">
            yuzuu.co/u/
            <b>
              <LiveHandle fallback={DEMO.handle} />
            </b>
          </span>
          <span className="sc-live">Live</span>
        </div>

        {/* All four screens share one grid cell, so the frame is as tall as
            the tallest screen and nothing ever gets clipped or jumps. */}
        <div className="sc-stack">
          <Screen index={0} active={active}>
            <Profile />
          </Screen>
          <Screen index={1} active={active}>
            <Quiz />
          </Screen>
          <Screen index={2} active={active}>
            <Checkout />
          </Screen>
          <Screen index={3} active={active}>
            <Plan />
          </Screen>
        </div>
      </div>
    </div>
  );
}

function Screen({
  index,
  active,
  children,
}: {
  index: number;
  active: number;
  children: React.ReactNode;
}) {
  const on = index === active;
  return (
    <div
      role="tabpanel"
      id={`sc-panel-${index}`}
      aria-labelledby={`sc-tab-${index}`}
      className={`sc-screen${on ? " is-on" : ""}`}
    >
      {/* Re-keyed on every switch so the fade replays each time a screen
          comes back around. */}
      <div key={active} className="sc-fade">
        {children}
      </div>
    </div>
  );
}

function Profile() {
  return (
    <div className="sc-profile">
      <div className="sc-who">
        <span className="sc-avatar" />
        <span>
          <b>{DEMO.creator}</b>
          <i>
            @<LiveHandle fallback={DEMO.handle} /> · built from your audience
          </i>
        </span>
      </div>
      <p className="sc-kicker">
        Personalized · {DEMO.days} days · {DEMO.questions} questions first
      </p>
      <h3 className="sc-h">{DEMO.product}</h3>
      <p className="sc-p">
        A personalized {DEMO.days}-day plan matched to the pieces you can actually find and the
        tools you already own — so your first flip sells instead of sitting in the garage.
      </p>
      <div className="sc-buy">
        <span className="sc-btn">Start the {DEMO.questions}-question quiz</span>
        <span className="sc-note">
          ${DEMO.price} · takes 2 minutes
        </span>
      </div>
    </div>
  );
}

const OPTIONS = [
  "A garage or a dedicated corner",
  "A balcony or patio, weather permitting",
  "The living room floor, sheets down",
  "Nothing set up yet — that's the problem",
];

function Quiz() {
  return (
    <div className="sc-quiz">
      <p className="sc-kicker">Question 3 of {DEMO.questions}</p>
      <h3 className="sc-h sc-h-sm">How much space do you have to work in?</h3>
      <p className="sc-p sc-p-sm">Go with your gut — nothing to measure here.</p>
      <ul className="sc-opts">
        {OPTIONS.map((opt, i) => (
          <li key={opt} className={`sc-opt${i === 0 ? " is-picked" : ""}`}>
            <span className="sc-box">{i === 0 ? "✓" : ""}</span>
            {opt}
          </li>
        ))}
      </ul>
      <div className="sc-progress">
        <span className="sc-progress-rail">
          <span style={{ width: `${(3 / DEMO.questions) * 100}%` }} />
        </span>
        <span className="sc-note">About 90 seconds left</span>
      </div>
    </div>
  );
}

const ANSWERS = [
  "Garage corner",
  "A basic tool kit",
  "Curb finds mostly",
  "Two evenings a week",
  "Never sold one",
];

const INCLUDED = [
  "7 sections written from your answers",
  `${DEMO.days}-day plan paced to you`,
  "A private page, yours to keep",
];

function Checkout() {
  return (
    <div className="sc-checkout">
      <div className="sc-recap">
        <p className="sc-kicker">Quiz complete · almost there</p>
        <h3 className="sc-h sc-h-sm">Your plan is ready to be written.</h3>
        <div className="sc-dark sc-answers">
          <p className="sc-kicker sc-kicker-dark">What you told us</p>
          <div className="sc-chips">
            {ANSWERS.map((a) => (
              <span key={a} className="sc-chip">
                {a}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="sc-cart">
        <p className="sc-kicker">You&apos;re getting</p>
        <h4 className="sc-cart-title">{DEMO.product}</h4>
        <ul className="sc-included">
          {INCLUDED.map((line) => (
            <li key={line}>
              <span className="sc-tick" />
              {line}
            </li>
          ))}
        </ul>
        <div className="sc-total">
          <span>Total</span>
          <b>${DEMO.price}</b>
        </div>
        <span className="sc-btn sc-btn-block">Pay securely</span>
        <p className="sc-yours">
          ${CREATOR_CUT} of that lands in your account.
        </p>
      </div>
    </div>
  );
}

const SIGNALS = [
  { label: "Workspace", score: 7 },
  { label: "Tool access", score: 4 },
  { label: "Sourcing habit", score: 6 },
  { label: "Finishing time", score: 3 },
];

const FIRST_WEEK = [
  ["Day 1", "Pick one piece, not three"],
  ["Day 2", "The $40 tool list you actually need"],
  ["Day 3", "Strip test on a panel nobody sees"],
];

function Plan() {
  return (
    <div className="sc-dark sc-plan">
      <p className="sc-kicker sc-kicker-dark">
        Your copy · personalized {DEMO.days}-day plan
      </p>
      <h3 className="sc-h sc-h-dark">{DEMO.product}</h3>
      <p className="sc-p sc-p-dark">
        Written for someone with a garage corner, a basic tool kit, curb finds to work with, and
        two free evenings a week.
      </p>

      <p className="sc-kicker sc-kicker-dark sc-kicker-gap">
        What&apos;s actually slowing your first flip down
      </p>
      <div className="sc-signals">
        {SIGNALS.map((s, i) => (
          <div key={s.label} className="sc-signal">
            <span className="sc-signal-label">{s.label}</span>
            <span className="sc-track">
              <span
                className="sc-fill"
                style={{ width: `${s.score * 10}%`, animationDelay: `${i * 0.07}s` }}
              />
            </span>
            <span className="sc-score">{s.score}</span>
          </div>
        ))}
      </div>

      <p className="sc-kicker sc-kicker-dark sc-kicker-gap">Your first week</p>
      <ol className="sc-days">
        {FIRST_WEEK.map(([day, title]) => (
          <li key={day}>
            <span className="sc-day">{day}</span>
            {title}
          </li>
        ))}
      </ol>
    </div>
  );
}
