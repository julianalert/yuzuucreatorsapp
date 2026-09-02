"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useFormStatus } from "react-dom";
import { cleanHandle } from "@/lib/pending-handle";
import { CREATOR_KEEP_PCT } from "@/lib/seo";
import { startGuestBuild } from "@/app/start/actions";

type HandleCtx = {
  handle: string;
  setHandle: (value: string) => void;
};

const Ctx = createContext<HandleCtx | null>(null);

function useHandle(): HandleCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("HandleSync components must sit inside HandleProvider");
  return ctx;
}

export function HandleProvider({ children }: { children: React.ReactNode }) {
  const [handle, setHandleState] = useState("");

  const setHandle = useCallback((value: string) => {
    setHandleState(cleanHandle(value));
  }, []);

  const value = useMemo(() => ({ handle, setHandle }), [handle, setHandle]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function HandleSubmit({ peel }: { peel?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className={peel ? "btn btn-peel" : "btn"} type="submit" disabled={pending}>
      {pending ? "Reading your account…" : "Build my product"}
    </button>
  );
}

export function HandleForm({
  id,
  inputId,
  peel,
}: {
  id?: string;
  inputId: string;
  peel?: boolean;
}) {
  const { handle, setHandle } = useHandle();

  return (
    <form className="handle" id={id} action={startGuestBuild}>
      <label className="visually-hidden" htmlFor={inputId}>
        Your Instagram handle
      </label>
      <div className="handle-row">
        <span className="at">@</span>
        <input
          id={inputId}
          type="text"
          name="handle"
          placeholder="your instagram handle"
          autoComplete="off"
          spellCheck={false}
          required
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
        />
        <HandleSubmit peel={peel} />
      </div>
      <p className="handle-note">
        $0 to build <span className="dot">·</span> you keep {CREATOR_KEEP_PCT}% <span className="dot">·</span>{" "}
        leave whenever
      </p>
    </form>
  );
}

export function LiveHandle({ fallback = "yourhandle" }: { fallback?: string }) {
  const { handle } = useHandle();
  return <>{handle || fallback}</>;
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
