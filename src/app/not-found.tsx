import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";
import { noIndex } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Page not found — Yuzuu",
  ...noIndex,
};

export default function NotFound() {
  return (
    <section>
      <header className="bar">
        <div className="bar-in">
          <Wordmark href="/" />
        </div>
      </header>
      <main className="wrap">
        <span className="micro">404</span>
        <h1 style={{ marginTop: 14 }}>That page isn&apos;t here.</h1>
        <p className="lede">The link may be old, or the product isn&apos;t live yet.</p>
        <p style={{ marginTop: 28 }}>
          <Link className="btn btn-primary" href="/">
            Back to Yuzuu
          </Link>
        </p>
      </main>
    </section>
  );
}
