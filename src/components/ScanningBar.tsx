import { Wordmark } from "@/components/Wordmark";

/** Dedicated header for the scanning step: no escape hatches, just the
 * mark, centered — this is not the place to invite someone to log in or
 * leave. Separate from StartLayout's bar so the rest of /start keeps its
 * normal "Log in" link untouched. */
export function ScanningBar() {
  return (
    <header className="bar">
      <div className="bar-in" style={{ justifyContent: "center" }}>
        <Wordmark href="/" />
      </div>
    </header>
  );
}
