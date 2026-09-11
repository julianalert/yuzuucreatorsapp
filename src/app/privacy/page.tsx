import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";
import { canonical } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Privacy Policy — Yuzuu",
  description:
    "How Yuzuu collects and uses data from creators, prospective creators, and buyers: accounts, Instagram research, payments, and your rights.",
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
          <p className="lede">Last updated September 2026 · yuzuu.co</p>

          <h2 style={{ marginTop: 30 }}>1. Who this applies to</h2>
          <p>
            This policy covers three kinds of people: creators who sign up to build a product
            with Yuzuu, prospective creators we research before they&apos;ve signed up at all,
            and buyers who purchase a product from a creator&apos;s page. What we collect and how
            we use it differs between the three, so we&apos;ve split the sections below.
          </p>

          <h2>2. What we collect from creators</h2>
          <ul className="built" style={{ marginTop: 16 }}>
            <li>
              <span>
                <b>Account info</b> — your name and email address from Google sign-in.
              </span>
            </li>
            <li>
              <span>
                <b>What you tell us</b> — the Instagram handle you connect (which you can enter
                before you sign in — see Section 3), and any optional description of what you
                help people with.
              </span>
            </li>
            <li>
              <span>
                <b>Your public Instagram content</b> — captions and comments from the handle you
                connect, read once to understand your audience and build your product. We
                don&apos;t read or store content from any other account, and we don&apos;t
                follow, post, or message on your behalf.
              </span>
            </li>
            <li>
              <span>
                <b>Payout info</b> — your bank transfer details (IBAN, name, and billing
                address) once you set up payouts. We never ask for or store card numbers.
              </span>
            </li>
            <li>
              <span>
                <b>Usage data</b> — sales, conversion, and dashboard activity tied to your
                account.
              </span>
            </li>
          </ul>

          <h2>3. What we collect before you&apos;ve signed up</h2>
          <p>
            Some data about a prospective creator exists before that person has an account, in
            two ways:
          </p>
          <ul className="built" style={{ marginTop: 16 }}>
            <li>
              <span>
                <b>A handle you enter yourself.</b> You can start a build from yuzuu.co by typing
                an Instagram handle before signing in. We hold that in-progress build — the
                handle and the public content we&apos;ve read from it — against a temporary
                cookie in your browser (Section 6) until you sign in with Google, at which point
                it&apos;s attached to your new account like any other creator data. If you never
                sign in, that data ages out along with the cookie.
              </span>
            </li>
            <li>
              <span>
                <b>A handle we research ourselves.</b> To pitch a finished product rather than an
                idea, we sometimes research a public Instagram account and build a product from
                it before that person has ever visited Yuzuu — reading the same public captions
                and comments described in Section 2, and creating an account to hold the result.
                Nothing built this way is published or visible to anyone but us until we reach
                out with a private link and the person it&apos;s for signs in to review it. If
                they decline, or never respond, we delete the account and everything we built
                from it. If someone signs up for a handle we&apos;ve already researched this way,
                their signup takes priority and our research is discarded.
              </span>
            </li>
          </ul>

          <h2>4. What we collect from buyers</h2>
          <ul className="built" style={{ marginTop: 16 }}>
            <li>The quiz answers a buyer submits on a creator&apos;s page.</li>
            <li>Their email address, to deliver the purchased plan and receipts.</li>
            <li>
              Payment details, handled directly by our payment processor — Yuzuu never sees or
              stores full card numbers.
            </li>
          </ul>

          <h2>5. How we use it</h2>
          <p>
            We use this information to research and generate a creator&apos;s personalized
            product (including for the prospective creators described in Section 3), run the
            quiz and checkout, deliver purchased content and receipts by email, operate the
            creator dashboard, and improve the build pipeline. Generating product content
            involves sending relevant text (captions, comments, quiz answers) to third-party AI
            models — never full account credentials or payment details.
          </p>

          <h2>6. Who we share it with</h2>
          <p>
            We don&apos;t sell personal data. We share the minimum necessary with the services
            that keep Yuzuu running:
          </p>
          <ul className="built" style={{ marginTop: 16 }}>
            <li>
              <span>
                <b>Supabase</b> — authentication and database hosting for account and order data.
              </span>
            </li>
            <li>
              <span>
                <b>OpenAI and Anthropic</b> — generate the research, quiz, and personalized
                written content.
              </span>
            </li>
            <li>
              <span>
                <b>Resend</b> — delivers purchase confirmations and the personalized plan by
                email.
              </span>
            </li>
            <li>
              <span>
                <b>Stripe</b> — processes buyer payments on Yuzuu&apos;s behalf, including tax
                calculation at checkout.
              </span>
            </li>
            <li>
              <span>
                <b>ScrapeCreators</b> — retrieves the public captions and comments from any
                handle we research, whether entered by a creator or by us.
              </span>
            </li>
          </ul>
          <p>
            A buyer&apos;s quiz answers, email, and order status are visible to the creator whose
            product they bought — that&apos;s how the creator dashboard and order support work —
            but not to any other creator on Yuzuu.
          </p>

          <h2>7. Cookies</h2>
          <p>
            We use a session cookie to keep you signed in, and — before you&apos;ve signed in — a
            temporary cookie that holds an in-progress build to your browser so you can pick up
            where you left off (Section 3). Neither is used for advertising or cross-site
            tracking, and we don&apos;t use third-party advertising or tracking cookies.
          </p>

          <h2>8. How long we keep it</h2>
          <p>
            We keep account and order data for as long as an account is active, plus whatever
            period we&apos;re required to retain records for tax and accounting purposes. If a
            creator deletes their account, we delete or anonymize their data beyond that
            retention window; a creator&apos;s exported buyer list is theirs to keep or delete
            independently of what happens to their Yuzuu account. A build we started ourselves
            (Section 3) that&apos;s declined, ignored past our follow-up window, or overtaken by
            that person&apos;s own signup is deleted, not just archived.
          </p>

          <h2>9. Your rights</h2>
          <p>
            You can ask us to access, correct, export, or delete your personal data by emailing
            hello (at) yuzuu (dot) co — including if we&apos;ve researched your public Instagram
            account under Section 3 and you&apos;d rather we hadn&apos;t. Creators can export or
            delete their buyer list directly from the dashboard at any time.
          </p>

          <h2>10. Children</h2>
          <p>Yuzuu isn&apos;t intended for anyone under 18, and we don&apos;t knowingly collect data from minors.</p>

          <h2>11. Changes to this policy</h2>
          <p>
            If we make a material change to how we handle personal data, we&apos;ll let you know
            by email or in your dashboard before it takes effect.
          </p>

          <h2>12. Contact</h2>
          <p>
            Questions about this policy go to hello (at) yuzuu (dot) co.
          </p>
        </div>
      </main>
    </section>
  );
}
