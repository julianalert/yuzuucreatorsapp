"use client";

import { useState } from "react";

/** Copy the preview link, with the usual two-second confirmation. */
export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
        } catch {
          return;
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? "Copied" : "Copy preview link"}
    </button>
  );
}

/**
 * Discard deletes an account and everything built under it, so make the admin
 * say the handle out loud before the form will submit.
 */
export function DiscardButton({ handle }: { handle: string }) {
  return (
    <button
      type="submit"
      className="btn btn-ghost btn-sm"
      onClick={(e) => {
        if (!confirm(`Delete the spec account for @${handle} and everything built for it?`)) {
          e.preventDefault();
        }
      }}
    >
      Discard
    </button>
  );
}
