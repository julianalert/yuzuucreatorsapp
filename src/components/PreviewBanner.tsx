import Link from "next/link";
import type { ReactNode } from "react";
import type { PreviewKind } from "@/lib/public";

/**
 * The bar above an unpublished product. Two very different readers see it:
 *
 * - "owner"  — the creator walking their own funnel before going live. They get
 *   the page-specific note passed in as children, plus a way back.
 * - "token"  — a creator being pitched a spec build, who has no account and has
 *   never heard of us. The one thing they need to know is that this is not
 *   live and nothing happens without them, so that copy is fixed across pages.
 */
export function PreviewBanner({ kind, children }: { kind: PreviewKind; children?: ReactNode }) {
  if (!kind) return null;

  if (kind === "token") {
    return (
      <div className="preview-note">
        <b>Preview</b> — this is your product, built from your public Instagram. It isn&rsquo;t
        live: nobody else can find this page, and nothing here takes payment. It only goes live
        if you say yes.
      </div>
    );
  }

  return (
    <div className="preview-note">
      <b>Preview</b> — {children}
      <Link href="/dashboard">Back to dashboard</Link>
    </div>
  );
}
