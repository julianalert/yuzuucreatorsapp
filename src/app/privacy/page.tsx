import type { Metadata } from "next";
import { Wordmark } from "@/components/Wordmark";

export const metadata: Metadata = {
  title: "Privacy Policy — Yuzuu",
};

export default function PrivacyPage() {
  return (
    <section>
      <header className="bar">
        <div className="bar-in">
          <Wordmark href="/" />
          <div className="right">
            <a className="btn btn-ghost btn-sm" href="/">
              Back to home
            </a>
          </div>
        </div>
      </header>

      <div className="wrap">
        <div className="doc">
          <span className="micro">Legal</span>
          <h1 style={{ marginTop: 14 }}>Privacy Policy</h1>
          <p className="lede">Last updated August 2026 · yuzuu.co</p>

          

          <h2 style={{ marginTop: 30 }}>1. Who this applies to</h2>
          <p>
            This policy covers two kinds of people: creators who sign up to build a product with
            Yuzuu, and buyers who purchase a product from a creator&apos;s page. What we collect
            and how we use it differs between the two, so we&apos;ve split the sections below.
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
                <b>What you tell us</b> — the Instagram handle you connect, and any optional
                description of what you help people with.
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
                <b>Payout info</b> — details needed to connect your payment account so buyers can
                pay you directly.
              </span>
            </li>
            <li>
              <span>
                <b>Usage data</b> — sales, conversion, and dashboard activity tied to your
                account.
              </span>
            </li>
          </ul>

          <h2>3. What we collect from buyers</h2>
          <ul className="built" style={{ marginTop: 16 }}>
            <li>The quiz answers a buyer submits on a creator&apos;s page.</li>
            <li>Their email address, to deliver the purchased plan and receipts.</li>
            <li>
              Payment details, handled directly by our payment processor — Yuzuu never sees or
              stores full card numbers.
            </li>
          </ul>

          <h2>4. How we use it</h2>
          <p>
            We use this information to research and generate a creator&apos;s personalized
            product, run the quiz and checkout, deliver purchased content and receipts by email,
            operate the creator dashboard, and improve the build pipeline. Generating product
            content involves sending relevant text (captions, comments, quiz answers) to
            third-party AI models — never full account credentials or payment details.
          </p>

          <h2>5. Who we share it with</h2>
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
                <b>Stripe</b> — processes buyer payments and creator payouts.
              </span>
            </li>
            <li>
              <span>
                <b>ScrapeCreators</b> — retrieves the public captions and comments from the
                handle a creator connects.
              </span>
            </li>
          </ul>
          <p>
            A buyer&apos;s quiz answers, email, and order status are visible to the creator whose
            product they bought — that&apos;s how the creator dashboard and order support work —
            but not to any other creator on Yuzuu.
          </p>

          <h2>6. Cookies</h2>
          <p>
            We use a session cookie to keep you signed in. We don&apos;t use third-party
            advertising or tracking cookies.
          </p>

          <h2>7. How long we keep it</h2>
          <p>
            We keep account and order data for as long as an account is active, plus whatever
            period we&apos;re required to retain records for tax and accounting purposes. If a
            creator deletes their account, we delete or anonymize their data beyond that
            retention window; a creator&apos;s exported buyer list is theirs to keep or delete
            independently of what happens to their Yuzuu account.
          </p>

          <h2>8. Your rights</h2>
          <p>
            You can ask us to access, correct, export, or delete your personal data by emailing
            hello (at) yuzuu (dot) co. Creators can export or delete their buyer list directly
            from the dashboard at any time.
          </p>

          <h2>9. Children</h2>
          <p>Yuzuu isn&apos;t intended for anyone under 18, and we don&apos;t knowingly collect data from minors.</p>

          <h2>10. Changes to this policy</h2>
          <p>
            If we make a material change to how we handle personal data, we&apos;ll let you know
            by email or in your dashboard before it takes effect.
          </p>

          <h2>11. Contact</h2>
          <p>
            Questions about this policy go to hello (at) yuzuu (dot) co.
          </p>
        </div>
      </div>
    </section>
  );
}
