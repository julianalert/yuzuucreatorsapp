"use client";

import { useCallback, useEffect, useState } from "react";

/** Yuzuu profile pages, laid out exactly as /u/[handle] renders them. Erin's
 * title and promise are stand-ins until hers is published; the rest is live
 * product copy. Add a creator by appending to this array — the switcher sizes
 * itself. */
type Creator = {
  handle: string;
  name: string;
  avatarUrl: string;
  /** Short name for the switcher pill. */
  short: string;
  title: string;
  promise: string;
  days?: number;
  questions: number;
};

const CREATORS: Creator[] = [
  {
    handle: "refurbishedish",
    name: "Erin Shuford • DIY Furniture Flips • MCM Refinishing",
    short: "Erin",
    avatarUrl:
      "https://ietpkvqwihxwnesuzvvw.supabase.co/storage/v1/object/public/avatars/246bfafb-89ba-438b-b48e-c58f0c3dfe49.jpg?v=1788268466377",
    title: "Your First Flip, Start to Sold",
    promise:
      "A personalized plan matched to the pieces you can actually find and the tools you already own — so your first flip sells instead of sitting in the garage.",
    questions: 12,
  },
  {
    handle: "seunokimi",
    name: "Seun Okimi",
    short: "Seun",
    avatarUrl:
      "https://ietpkvqwihxwnesuzvvw.supabase.co/storage/v1/object/public/avatars/d420c535-65b8-44c0-822c-fd45d23bb495.jpg?v=1788385701348",
    title: "Wash Day Routine Personalization",
    promise:
      "A 14-day plan to build your own efficient wash-day routine — matched to your porosity, scalp needs, and sensitivities — so wash day takes less time and leaves less breakage.",
    days: 14,
    questions: 10,
  },
  {
    handle: "mydisciplinedrive",
    name: "Ben | Discipline Coach for Dads",
    short: "Ben",
    avatarUrl:
      "https://ietpkvqwihxwnesuzvvw.supabase.co/storage/v1/object/public/avatars/f64e0f07-9f5b-40f0-a4b3-8f49b46030cf.jpg?v=1788267861197",
    title: "Morning Energy Kickstart",
    promise:
      "A personalized 21-day morning movement plan matched to your energy blockers (poor sleep, no routine, low motivation, or physical stiffness) so waking up and getting going stops feeling like a fight.",
    days: 21,
    questions: 11,
  },
];

const ADVANCE_MS = 4500;

export function HeroShowcase() {
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(true);

  useEffect(() => {
    if (CREATORS.length < 2 || !auto) return;
    const t = setInterval(() => setActive((i) => (i + 1) % CREATORS.length), ADVANCE_MS);
    return () => clearInterval(t);
  }, [auto]);

  // A click means the visitor is driving now — stop rotating under them.
  const pick = useCallback((i: number) => {
    setAuto(false);
    setActive(i);
  }, []);

  const current = CREATORS[active];

  return (
    <div className="showcase">
      <div className="sc-tabs" role="tablist" aria-label="Pick a creator">
        {CREATORS.map((creator, i) => (
          <button
            key={creator.handle}
            type="button"
            role="tab"
            id={`sc-tab-${i}`}
            aria-selected={active === i}
            aria-controls={`sc-panel-${i}`}
            className={`sc-tab${active === i ? " is-on" : ""}`}
            onClick={() => pick(i)}
          >
            {/* Sweeps across the active pill over one interval, so the
                rotation reads as deliberate rather than as a random jump.
                Re-keyed on `active` to restart; gone once a click takes over. */}
            {auto && active === i ? (
              <span
                key={active}
                className="sc-tab-timer"
                style={{ animationDuration: `${ADVANCE_MS}ms` }}
              />
            ) : null}
            {/* eslint-disable-next-line @next/next/no-img-element -- storage-hosted avatar, not worth next/image remote-pattern config */}
            <img
              className="sc-tab-face"
              src={creator.avatarUrl}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
            />
            <span className="sc-tab-text">
              <b>{creator.short}</b>
              <i>@{creator.handle}</i>
            </span>
          </button>
        ))}
      </div>

      <div className="sc-frame">
        <div className="sc-bar">
          <span className="sc-pip" />
          <span className="sc-pip" />
          <span className="sc-pip" />
          <span className="sc-url">
            yuzuu.co/u/<b>{current.handle}</b>
          </span>
          <span className="sc-live">Live</span>
        </div>

        {/* Every creator's page sits in the same grid cell, so the frame is as
            tall as the longest one: switching never shifts the page. */}
        <div className="sc-stack">
          {CREATORS.map((creator, i) => (
            <div
              key={creator.handle}
              role="tabpanel"
              id={`sc-panel-${i}`}
              aria-labelledby={`sc-tab-${i}`}
              className={`sc-screen${active === i ? " is-on" : ""}`}
            >
              {/* Re-keyed on every switch so the fade replays each time. */}
              <div key={active} className="sc-fade">
                <Profile creator={creator} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Profile({ creator }: { creator: Creator }) {
  return (
    <div className="sc-profile">
      <div className="sc-who">
        {/* eslint-disable-next-line @next/next/no-img-element -- storage-hosted avatar, not worth next/image remote-pattern config */}
        <img
          className="sc-avatar"
          src={creator.avatarUrl}
          alt={creator.name}
          loading="lazy"
          referrerPolicy="no-referrer"
        />
        <span>
          <b>{creator.name}</b>
          <i>@{creator.handle}</i>
        </span>
      </div>

      <p className="sc-kicker">
        Personalized · {creator.days ? `${creator.days} days · ` : ""}
        {creator.questions} questions first
      </p>
      <h3 className="sc-h">{creator.title}</h3>
      <p className="sc-p">{creator.promise}</p>

      <div className="sc-buy">
        <span className="sc-btn">Start the {creator.questions}-question quiz</span>
        <span className="sc-note">Takes about 2 minutes</span>
      </div>
    </div>
  );
}
