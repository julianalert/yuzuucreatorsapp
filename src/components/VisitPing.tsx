"use client";

import { useEffect } from "react";

/**
 * One page_visit beacon per tab session. Fire-and-forget: analytics must
 * never slow down or break the sales page.
 */
export function VisitPing({ handle }: { handle: string }) {
  useEffect(() => {
    const key = `yz_visited_${handle}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // storage unavailable — still count the visit
    }
    fetch("/api/creator-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle, type: "page_visit" }),
      keepalive: true,
    }).catch(() => {});
  }, [handle]);
  return null;
}
