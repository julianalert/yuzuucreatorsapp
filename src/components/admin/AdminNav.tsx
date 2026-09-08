import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";

/**
 * The admin header. One component so the three sections are always reachable
 * from each other — before this, every admin page carried a different, partial
 * set of links.
 */
const LINKS = [
  { href: "/admin", label: "KPIs" },
  { href: "/admin/spec", label: "Spec builds" },
  { href: "/admin/payouts", label: "Payouts" },
] as const;

export function AdminNav({
  /** Href of the section being viewed, so it can be marked current. */
  current,
  /** Extra breadcrumb for detail pages, e.g. "build 1a2b3c4d". */
  crumb,
}: {
  current?: string;
  crumb?: string;
}) {
  return (
    <header className="bar">
      <div className="bar-in wide">
        <Wordmark href="/dashboard" />
        <span className="micro">{crumb ? `Admin · ${crumb}` : "Admin"}</span>
        <div className="right">
          {LINKS.map((l) => {
            const on = l.href === current;
            return (
              <Link
                key={l.href}
                className={`btn btn-ghost btn-sm${on ? " on" : ""}`}
                href={l.href}
                aria-current={on ? "page" : undefined}
              >
                {l.label}
              </Link>
            );
          })}
        </div>
      </div>
    </header>
  );
}
