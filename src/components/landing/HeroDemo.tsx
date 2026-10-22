"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

/** One case per journey, played message by message. `step` is how far along
 * the journey the case is once that message has landed; `steps.length` means
 * the journey is complete. Fields fill in as the conversation produces them. */
type Msg = {
  by: "client" | "agent" | "you" | "event";
  text: string;
  step: number;
};

type Scenario = {
  id: string;
  journey: string;
  service: string;
  business: string;
  client: string;
  channel: string;
  caseNo: string;
  steps: string[];
  msgs: Msg[];
  fields: { k: string; v: string; at: number }[];
};

const SCENARIOS: Scenario[] = [
  {
    id: "standard",
    journey: "Fixed price",
    service: "Sofa cleaning",
    business: "Fresh Fabric Co.",
    client: "Emma R.",
    channel: "Website chat",
    caseNo: "C-1042",
    steps: ["Questions", "Price by rules", "Slot", "Deposit", "Job"],
    msgs: [
      { by: "client", text: "Hi! How much to clean a 3-seater fabric sofa? There’s a coffee stain.", step: 0 },
      { by: "agent", text: "Happy to help. Is it a straight or corner sofa, and any pets at home?", step: 0 },
      { by: "client", text: "Straight, no pets.", step: 1 },
      { by: "agent", text: "That’s $129, stain treatment included. I have Thu 10:00 or Fri 14:00 in Riverside.", step: 2 },
      { by: "client", text: "Friday please!", step: 3 },
      { by: "agent", text: "Booked. A $30 deposit holds your slot. Here’s a secure link.", step: 3 },
      { by: "event", text: "Deposit paid · $30 · reminder set for Thursday", step: 4 },
      { by: "event", text: "Job done · $99 balance collected · review requested", step: 5 },
    ],
    fields: [
      { k: "Price", v: "$129 · rule: 3-seater + stain", at: 4 },
      { k: "Slot", v: "Fri 14:00 · Riverside", at: 5 },
      { k: "Paid", v: "$30 deposit · then $99", at: 7 },
    ],
  },
  {
    id: "diagnose",
    journey: "Diagnosis",
    service: "Boiler breakdown",
    business: "Bright Heat Co.",
    client: "Daniel K.",
    channel: "Text message",
    caseNo: "C-1043",
    steps: ["Qualify", "Call-out terms", "Slot request", "Confirmed", "Diagnosis"],
    msgs: [
      { by: "client", text: "Boiler stopped this morning. No hot water at all.", step: 0 },
      { by: "agent", text: "Sorry about that. Which brand is it, and is there a code on the display? A photo helps.", step: 0 },
      { by: "client", text: "📷 Photo attached · display says F28", step: 1 },
      { by: "agent", text: "Thanks. A diagnostic visit is $89, taken off the repair if you go ahead. OK for you?", step: 1 },
      { by: "client", text: "Yes, as soon as possible.", step: 2 },
      { by: "agent", text: "Earliest in your area is tomorrow 8–10am. Asking Mark to confirm now.", step: 3 },
      { by: "you", text: "Confirmed. I’ll bring an F28 ignition kit.", step: 4 },
      { by: "event", text: "Diagnosis done · $240 repair approved on site", step: 5 },
    ],
    fields: [
      { k: "Equipment", v: "Combi boiler · code F28", at: 3 },
      { k: "Call-out", v: "$89 · deducted from repair", at: 4 },
      { k: "Slot", v: "Tue 8–10am · Mark", at: 6 },
    ],
  },
  {
    id: "quote",
    journey: "Quote",
    service: "Heat pump install",
    business: "Bright Heat Co.",
    client: "Anna L.",
    channel: "Contact form",
    caseNo: "C-1044",
    steps: ["Photos & info", "Site visit", "Quote", "Follow-ups", "Signed + deposit", "Planned"],
    msgs: [
      { by: "client", text: "We’d like air conditioning in 3 bedrooms.", step: 0 },
      { by: "agent", text: "Great project. Could you send a photo of each room, and where the outdoor unit could go?", step: 0 },
      { by: "client", text: "📷 4 photos · 3 rooms + back wall", step: 1 },
      { by: "agent", text: "Thanks Anna. Mark can come Tuesday 17:30 to measure. Does that work?", step: 1 },
      { by: "you", text: "Visit done. Quote sent: 3 units, $6,840.", step: 3 },
      { by: "agent", text: "Hi Anna, any questions on the quote? Happy to walk you through the options.", step: 3 },
      { by: "client", text: "All clear. Signing now!", step: 4 },
      { by: "event", text: "Signed · $2,052 deposit paid · install planned Mar 12", step: 6 },
    ],
    fields: [
      { k: "Photos", v: "4 received", at: 3 },
      { k: "Quote", v: "$6,840 · follow-up day 3", at: 5 },
      { k: "Deposit", v: "$2,052 · install Mar 12", at: 8 },
    ],
  },
  {
    id: "recurring",
    journey: "Recurring",
    service: "Weekly pool care",
    business: "Blue Lagoon Pools",
    client: "Henri D.",
    channel: "Booking link",
    caseNo: "C-1045",
    steps: ["Qualify", "Frequency", "Recurring plan", "Visits tracked", "Billing + renewal"],
    msgs: [
      { by: "client", text: "Can someone look after our pool this summer?", step: 0 },
      { by: "agent", text: "Of course. Roughly what size, and is it chlorine or salt?", step: 0 },
      { by: "client", text: "8 × 4 m, salt.", step: 1 },
      { by: "agent", text: "Weekly is $65 a visit. Mondays match your street’s route. Start June 2?", step: 2 },
      { by: "client", text: "Perfect.", step: 3 },
      { by: "event", text: "Visit 4 of 16 done · photo report sent · $65 invoiced", step: 4 },
      { by: "agent", text: "The season ends in two weeks. Shall I renew you for autumn, every other week?", step: 4 },
      { by: "client", text: "Yes, do that.", step: 5 },
    ],
    fields: [
      { k: "Pool", v: "8 × 4 m · salt", at: 3 },
      { k: "Plan", v: "Weekly · Mondays · $65", at: 4 },
      { k: "Visits", v: "4 of 16 done · renewal offered", at: 6 },
    ],
  },
];

const STEP_MS = 1500;
const HOLD_MS = 3600;
const durationOf = (s: Scenario) => s.msgs.length * STEP_MS + HOLD_MS;

const WHO: Record<Msg["by"], string> = {
  client: "",
  agent: "Yuzuu agent",
  you: "You",
  event: "",
};

const REDUCED = "(prefers-reduced-motion: reduce)";

function subscribeMotion(onChange: () => void) {
  const mq = window.matchMedia(REDUCED);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

export function HeroDemo() {
  const [active, setActive] = useState(0);
  const [shown, setShown] = useState(1);
  const [picked, setPicked] = useState(false);
  // Reduced motion: show every case finished and let the visitor flip tabs.
  const still = useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia(REDUCED).matches,
    () => false
  );
  const auto = !picked && !still;

  const scenario = SCENARIOS[active];
  const total = scenario.msgs.length;
  const count = still ? total : shown;

  useEffect(() => {
    if (still) return;
    if (shown < total) {
      const t = setTimeout(() => setShown((n) => n + 1), STEP_MS);
      return () => clearTimeout(t);
    }
    if (!auto) return;
    const t = setTimeout(() => {
      setActive((i) => (i + 1) % SCENARIOS.length);
      setShown(1);
    }, HOLD_MS);
    return () => clearTimeout(t);
  }, [shown, total, auto, still]);

  // A click means the visitor is driving now: play that case, then stop.
  const pick = useCallback((i: number) => {
    setPicked(true);
    setActive(i);
    setShown(1);
  }, []);

  const msgs = scenario.msgs.slice(0, count);
  const step = msgs[msgs.length - 1]?.step ?? 0;
  const done = step >= scenario.steps.length;

  return (
    <div className="showcase demo">
      <div className="sc-tabs" role="tablist" aria-label="Pick a journey">
        {SCENARIOS.map((s, i) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            id={`demo-tab-${i}`}
            aria-selected={active === i}
            aria-controls="demo-panel"
            className={`sc-tab demo-tab${active === i ? " is-on" : ""}`}
            onClick={() => pick(i)}
          >
            {auto && active === i ? (
              <span
                key={active}
                className="sc-tab-timer"
                style={{ animationDuration: `${durationOf(s) - STEP_MS}ms` }}
              />
            ) : null}
            <span className="sc-tab-text">
              <b>{s.journey}</b>
              <i>{s.service}</i>
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
            app.yuzuu.co/cases/<b>{scenario.caseNo}</b>
          </span>
          <span className="sc-live">Agents on</span>
        </div>

        <div className="demo-body" id="demo-panel" role="tabpanel" aria-labelledby={`demo-tab-${active}`}>
          <div className="demo-thread" aria-live="polite">
            <div className="demo-thread-in">
              {msgs.map((m, i) => (
                <div key={`${scenario.id}-${i}`} className={`bub bub-${m.by}`}>
                  {WHO[m.by] ? <span className="bub-who">{WHO[m.by]}</span> : null}
                  <p>{m.text}</p>
                </div>
              ))}
              {!done && !still && count < total ? (
                <div
                  className={`bub-typing ${
                    scenario.msgs[count].by === "client" ? "is-client" : "is-us"
                  }`}
                  aria-hidden="true"
                >
                  <span />
                  <span />
                  <span />
                </div>
              ) : null}
            </div>
          </div>

          <aside className="demo-case" aria-label="Case summary">
            <div className="demo-case-head">
              <span className="demo-kicker">
                {scenario.caseNo} · {scenario.channel}
              </span>
              <b>{scenario.client}</b>
              <span className="demo-svc">
                {scenario.service} <i>· {scenario.business}</i>
              </span>
              <span className="demo-journey">{scenario.journey} journey</span>
            </div>

            <ol className="demo-steps">
              {scenario.steps.map((label, i) => (
                <li
                  key={label}
                  className={i < step ? "is-done" : i === step ? "is-now" : undefined}
                >
                  <span className="demo-tick" aria-hidden="true" />
                  {label}
                </li>
              ))}
            </ol>

            <dl className="demo-fields">
              {scenario.fields.map((f) => (
                <div key={f.k} className={count >= f.at ? "is-set" : undefined}>
                  <dt>{f.k}</dt>
                  <dd>{count >= f.at ? f.v : "—"}</dd>
                </div>
              ))}
            </dl>

            <p className={`demo-status${done ? " is-paid" : ""}`}>
              {done ? "✓ Complete. No admin left." : "In progress · agents on it"}
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}
