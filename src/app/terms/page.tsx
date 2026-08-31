import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";
import { canonical } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Terms of Service — Yuzuu",
  description:
    "Terms for using Yuzuu: who can join, how builds and payouts work, ownership, buyer purchases, and leaving.",
  ...canonical("/terms"),
};

export default function TermsPage() {
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
          <h1 style={{ marginTop: 14 }}>Terms of Service</h1>
          <p className="lede">Last updated August 2026 · yuzuu.co</p>

          
          <h2 style={{ marginTop: 30 }}>1. What Yuzuu is</h2>
          <p>
            Yuzuu (&quot;we&quot;, &quot;us&quot;) builds a personalized digital product for
            creators (&quot;you&quot;, &quot;creator&quot;) based on a public Instagram account
            you connect. That includes a quiz, personalized written content, a sales page, and a
            checkout flow, hosted at a page under your name (e.g. yuzuu.co/u/yourhandle, or a
            custom domain you connect). People who buy from that page are &quot;buyers.&quot;
          </p>

          <h2>2. Who can use Yuzuu</h2>
          <ul className="built" style={{ marginTop: 16 }}>
            <li>You&apos;re at least 18 years old and able to enter a binding agreement.</li>
            <li>
              You have the right to represent the Instagram account you connect — it&apos;s
              yours, or you&apos;re authorized to act on its behalf.
            </li>
            <li>The account is public, or made public for the duration of the build.</li>
            <li>
              You&apos;ll give us accurate information (your email, your handle, and anything you
              tell us about your audience) and keep your account credentials to yourself.
            </li>
          </ul>

          <h2>3. The build, and your approval</h2>
          <p>
            You give us a handle and pick a product direction from the options we propose. We
            research, draft, and test the product against a set of internal checks before you
            ever see it. You then review real samples and decide whether they go live under your
            name — nothing publishes without that approval.
          </p>
          <p>
            Some builds don&apos;t make it that far. We may decline to build or ship a product if
            your public content doesn&apos;t give us enough to work with, if we can&apos;t find a
            product angle we&apos;re confident will personalize honestly for your audience, or if
            a build fails our internal quality checks twice. That&apos;s a decision about
            build quality, not a judgment of you or your content, and we&apos;ll tell you why.
          </p>

          <h2>4. Fees and payouts</h2>
          <p>
            There&apos;s no upfront fee to build your product. Buyers pay Yuzuu directly —
            payments are processed by Stripe on Yuzuu&apos;s account, with any applicable
            VAT or sales tax added on top of the listed price. Your share is 70% of the
            tax-exclusive sale price, credited to your Yuzuu balance; payment processing fees
            come out of Yuzuu&apos;s share, not yours. We don&apos;t change your split
            retroactively on sales you&apos;ve already made.
          </p>
          <p>
            A sale becomes payable 14 days after purchase, once its refund window closes.
            Payouts go out monthly once your balance reaches $50 — below that it rolls into the
            next month. Refunds and chargebacks reduce your balance by your share of the
            refunded sale; if that makes the balance negative, it carries into future sales.
            Your live balance and every line behind it are always visible in your dashboard.
          </p>

          <h2>5. Ownership</h2>
          <p>
            You own the product, the page, and your buyer list. You can export your buyer list at
            any time, and if you stop using Yuzuu you keep the last version of your product
            content and your list — we don&apos;t hold either hostage. Yuzuu retains ownership of
            the underlying pipeline, templates, and technology used to build it.
          </p>

          <h2>6. What you can sell through Yuzuu</h2>
          <p>
            Your product has to be something we actually built and you approved — you can&apos;t
            use the page or checkout we provide to sell something else entirely. Content that
            touches health, money, or legal topics gets a stricter review pass and has to avoid
            promises, diagnoses, or advice that should come from a licensed professional instead.
            We don&apos;t build or host content that&apos;s illegal, hateful, sexually explicit,
            or deceptive about what a buyer is actually getting.
          </p>

          <h2>7. Buyer purchases and refunds</h2>
          <p>
            Buyers purchase from Yuzuu, the merchant of record: Yuzuu operates the checkout,
            processes the payment, delivers the product, and handles support and refunds. The
            product itself is created from your content and approved by you, and that&apos;s how
            it&apos;s presented on your page. Buyers can request a full refund within 14 days of
            purchase; if we can&apos;t deliver a purchased plan, the buyer is refunded
            automatically. Refunds reduce your balance by your share of the sale, the same
            proportion as the original split.
          </p>

          <h2>8. Leaving</h2>
          <p>
            You can stop using Yuzuu at any time — there&apos;s no contract and no lock-in. You
            keep your buyer list and the last version of your product content. We may suspend or
            end an account that violates these terms, misrepresents who&apos;s behind the
            connected handle, or is used to sell something we didn&apos;t build.
          </p>

          <h2>9. No professional advice</h2>
          <p>
            Personalized plans generated through Yuzuu are informational content written to match
            a buyer&apos;s quiz answers. They aren&apos;t medical, financial, legal, or other
            licensed professional advice, and neither you nor Yuzuu should present them as such.
          </p>

          <h2>10. Disclaimers and limitation of liability</h2>
          <p>
            Yuzuu is provided &quot;as is.&quot; We work hard to keep builds accurate and on-voice
            for you, but we don&apos;t guarantee any particular sales outcome. To the extent
            allowed by law, Yuzuu&apos;s liability for any claim relating to the service is
            limited to the fees Yuzuu actually received from your account in the three months
            before the claim arose.
          </p>

          <h2>11. Changes to these terms</h2>
          <p>
            We may update these terms as the product changes. If a change is material, we&apos;ll
            let you know by email or in your dashboard before it takes effect. Continuing to use
            Yuzuu after that means you accept the update.
          </p>

          <h2>12. Contact</h2>
          <p>
            Questions about these terms go to{" "}
            hello (at) yuzuu (dot) co.
          </p>
        </div>
      </main>
    </section>
  );
}
