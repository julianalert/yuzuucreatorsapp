"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { joinWaitlist, type WaitlistState } from "@/app/actions";
import { TRADES } from "@/lib/trades";

const INITIAL: WaitlistState = { status: "idle" };

function Submit({ peel }: { peel?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className={peel ? "btn btn-peel" : "btn"} type="submit" disabled={pending}>
      {pending ? "Saving your spot…" : "Get early access"}
    </button>
  );
}

export function WaitlistForm({
  inputId,
  source,
  peel,
  withTrade,
}: {
  inputId: string;
  /** Which form on the page this is, so signups can be traced to a section. */
  source: string;
  peel?: boolean;
  /** Adds the optional "your trade" picker under the field. */
  withTrade?: boolean;
}) {
  const [state, action] = useActionState(joinWaitlist, INITIAL);

  if (state.status === "ok") {
    return (
      <div className="wl-done" role="status">
        <b>You’re on the list.</b>
        <span>
          {state.email ? (
            <>
              We’ll email <i>{state.email}</i> when your spot opens.
            </>
          ) : (
            "We’ll email you when your spot opens."
          )}{" "}
          Nothing before that.
        </span>
      </div>
    );
  }

  return (
    <form className="handle wl" action={action}>
      <label className="visually-hidden" htmlFor={inputId}>
        Your work email
      </label>
      <div className="handle-row">
        <input
          id={inputId}
          type="email"
          name="email"
          placeholder="you@yourbusiness.com"
          autoComplete="email"
          required
        />
        <Submit peel={peel} />
      </div>
      <input type="hidden" name="source" value={source} />
      {/* Honeypot — off-screen and skipped by keyboard and autofill. */}
      <input
        className="visually-hidden"
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
      />
      {withTrade ? (
        <div className="wl-trade">
          <label htmlFor={`${inputId}-trade`}>Your trade</label>
          <select id={`${inputId}-trade`} name="trade" defaultValue="">
            <option value="">Pick one (optional)</option>
            {TRADES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
            <option value="Other">Something else</option>
          </select>
        </div>
      ) : null}
      {state.status === "error" ? (
        <p className="wl-error" role="alert">
          {state.message}
        </p>
      ) : null}
      <p className="handle-note">
        Free to join <span className="dot">·</span> no card <span className="dot">·</span> one
        email when your spot opens
      </p>
    </form>
  );
}

export function RiseObserve() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll(".peel .rise"));
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      els.forEach((el) => el.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return null;
}
