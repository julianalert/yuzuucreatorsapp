import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";
import { canonical } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Privacy Policy — Yuzuu",
  description:
    "How Yuzuu handles the data of people who join the early-access waitlist, and of accounts from our earlier creator product.",
  ...canonical("/privacy"),
};

export default function PrivacyPage() {
  return (
    <section>
      <header className="bar">
        <div className="bar-in">
          <Wordmark href="/" />
          <div className="right">
            <Link className="btn btn-ghost btn-sm" href="/">
              Back to home
            </Link>
          </div>
        </div>
      </header>

      <main className="wrap">
        <div className="doc">
          <span className="micro">Legal</span>
          <h1 style={{ marginTop: 14 }}>Privacy Policy</h1>
          <p className="lede">Last updated October 2026 · yuzuu.co</p>

          <h2 style={{ marginTop: 30 }}>1. Who this applies to</h2>
          <p>
            Yuzuu is preparing the launch of a platform for home service businesses. Today, this
            site does one thing: it lets you join the early-access waitlist. This policy explains
            what we collect when you do, and what happens to data from our earlier creator
            product.
          </p>

          <h2>2. What we collect on the waitlist</h2>
          <p>
            Your email address, the trade you pick if you choose one, which form on the page you
            used, and the date you signed up. We don&apos;t ask for anything else, and we
            don&apos;t buy or enrich data about you from other sources.
          </p>

          <h2>3. How we use it</h2>
          <p>
            To send you a confirmation, then one email when your early-access spot opens, and to
            understand which trades are interested so we can open access in the right order. If
            you reply to us, we use your message to answer you. We don&apos;t sell your data or
            share it for anyone else&apos;s marketing.
          </p>

          <h2>4. Who processes it for us</h2>
          <p>
            We store waitlist data with Supabase (database hosting) and send email through Resend.
            The site is hosted on Vercel, and we use Simple Analytics, which counts visits without
            cookies or personal data. These providers handle data only to run the service for us.
          </p>

          <h2>5. Earlier creator product</h2>
          <p>
            Yuzuu previously ran a product that built digital products for Instagram creators. That
            product is closed. Account and order records from it are kept only as long as tax and
            accounting rules require, then deleted. You can ask us to delete your data at any time
            (Section 7).
          </p>

          <h2>6. How long we keep waitlist data</h2>
          <p>
            Until you ask us to remove it, or until early access has fully opened and we no longer
            need it to contact you, whichever comes first.
          </p>

          <h2>7. Your rights</h2>
          <p>
            You can ask us to access, correct, export or delete your personal data, or to take you
            off the waitlist, by emailing hello (at) yuzuu (dot) co. We&apos;ll act on it promptly.
          </p>

          <h2>8. Changes to this policy</h2>
          <p>
            If we change how we handle personal data in a material way, we&apos;ll update this page
            and, if it affects you, tell you by email before it takes effect.
          </p>

          <h2>9. Contact</h2>
          <p>Questions about this policy go to hello (at) yuzuu (dot) co.</p>
        </div>
      </main>
    </section>
  );
}
