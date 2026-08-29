"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { cleanHandle, HANDLE_COOKIE } from "@/lib/pending-handle";
import { CREATOR_KEEP_PCT } from "@/lib/seo";

type HandleCtx = {
  handle: string;
  setHandle: (value: string) => void;
  submit: () => void;
};

const Ctx = createContext<HandleCtx | null>(null);

function useHandle(): HandleCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("HandleSync components must sit inside HandleProvider");
  return ctx;
}

export function HandleProvider({ children }: { children: React.ReactNode }) {
  const [handle, setHandleState] = useState("");
  const router = useRouter();

  const setHandle = useCallback((value: string) => {
    setHandleState(cleanHandle(value));
  }, []);

  const submit = useCallback(() => {
    const h = cleanHandle(handle);
    const secure = window.location.protocol === "https:" ? "; secure" : "";
    if (h) {
      document.cookie = `${HANDLE_COOKIE}=${encodeURIComponent(h)}; path=/; max-age=3600; samesite=lax${secure}`;
    }
    router.push("/auth");
  }, [handle, router]);

  const value = useMemo(() => ({ handle, setHandle, submit }), [handle, setHandle, submit]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
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
  const { handle, setHandle, submit } = useHandle();

  return (
    <form
      className="handle"
      id={id}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <label className="visually-hidden" htmlFor={inputId}>
        Your Instagram handle
      </label>
      <div className="handle-row">
        <span className="at">@</span>
        <input
          id={inputId}
          type="text"
          placeholder="yourhandle"
          autoComplete="off"
          spellCheck={false}
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
        />
        <button className={peel ? "btn btn-peel" : "btn"} type="submit">
          Build my product
        </button>
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
