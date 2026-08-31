import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";

/** Pre-signup pages: no user menu, just a way home and a login escape hatch. */
export default function StartLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="bar">
        <div className="bar-in">
          <Wordmark href="/" />
          <div className="right">
            <Link className="btn btn-ghost btn-sm" href="/auth">
              Log in
            </Link>
          </div>
        </div>
      </header>
      {children}
    </>
  );
}
