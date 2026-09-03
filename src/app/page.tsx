import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Bricolage_Grotesque, DM_Mono } from "next/font/google";
import { getSignedInUser } from "@/lib/auth";
import { Wordmark } from "@/components/Wordmark";
import { Yuzu } from "@/components/Yuzu";
import { JsonLd } from "@/components/JsonLd";
import {
  HandleForm,
  HandleProvider,
  RiseObserve,
} from "@/components/landing/HandleSync";
import { HeroShowcase } from "@/components/landing/HeroShowcase";
import { LANDING_FAQ, faqPageJsonLd } from "@/lib/landing-faq";
import { CREATOR_KEEP_PCT, PLATFORM_KEEP_PCT, SITE_DESCRIPTION, SITE_TITLE, canonical } from "@/lib/seo";
import "./landing.css";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-dm-mono",
});

export const metadata: Metadata = {
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  ...canonical("/"),
};

/** Why a guest build ended back on the homepage. Keys are builds.halted_at
 * values (or statuses) carried in ?error= by the guest flow. */
const GUEST_ERRORS: Record<string, string> = {
  handle:
    "That doesn't look like an Instagram handle — letters, numbers, dots and underscores only.",
  limit: "You've hit the limit of builds from this browser. Sign up to continue, or get in touch.",
  profile_restricted:
    "Instagram restricts this profile to logged-in viewers, so we can't read it from outside. Check Settings → Account privacy on Instagram, then try again.",
  thin_content:
    "That account came back with too little public content for us to read the audience. If it's private, make it public and try again.",
  audience_confidence:
    "We couldn't read this audience confidently enough from what's public — we'd rather decline than build something mediocre.",
  no_viable_topic:
    "We couldn't find a product angle personalizable enough for this audience. Some niches just don't split into different buyer situations yet.",
  declined: "We couldn't build from that account yet. Try another handle.",
  failed: "The scan stopped partway. Try again — this is usually transient.",
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; error?: string }>;
}) {
  // Fallback for OAuth providers that land the `code` on the bare homepage
  // instead of /auth/callback (happens when the redirect URL used at
  // sign-in isn't in Supabase's allow-listed Redirect URLs) — forward it so
  // sign-in still completes instead of silently failing.
  const { code, error } = await searchParams;
  if (code) redirect(`/auth/callback?code=${encodeURIComponent(code)}&next=/onboard`);

  const user = await getSignedInUser();
  if (user) redirect("/dashboard");

  return (
    <div className={`peel ${bricolage.variable} ${dmMono.variable}`}>
      <JsonLd data={faqPageJsonLd()} />
      <HandleProvider>
        <RiseObserve />

        <nav className="nav">
          <div className="wrap nav-in">
            <Wordmark href="#top" />
            <div className="nav-links">
              <a href="#how">How it works</a>
              <a href="#money">Pricing</a>
              <a href="#faq">FAQs</a>
            </div>
            <div className="nav-end">
              <Link href="/auth">Log in</Link>
              <a className="btn btn-peel" href="#claim">
                Claim a build
              </a>
            </div>
          </div>
        </nav>

        <main>
        <header className="hero" id="top">
          <div className="wrap hero-in">
            <Yuzu className="yz-hero" size={64} mood="happy" tilt={-8} float />
            <p className="eyebrow">For Instagram creators · 5k–1M</p>
            <h1>
              Done-for-you digital product, <em>for free</em>
            </h1>
            <p className="hero-sub">
              Yuzuu studies your audience, proposes product ideas, and builds the whole thing:
              quiz, sales page, personalized output. It costs you nothing and you keep{" "}
              {CREATOR_KEEP_PCT}% of every sale!
            </p>
            {error ? (
              <div className="notice warn" style={{ marginBottom: 18 }}>
                {GUEST_ERRORS[error] ?? "Something went wrong — try again."}
              </div>
            ) : null}
            <HandleForm id="start" inputId="handle-hero" peel />

            <p className="eyebrow showcase-label">Here&apos;s what we build for you</p>
            <HeroShowcase />
          </div>
        </header>

        <section id="problem">
          <div className="wrap">
            <div className="section-head rise">
              <p className="eyebrow">The shelf is empty</p>
              <h2>You&apos;ve had the audience for a while. Where&apos;s the revenue?</h2>
              <p className="lede">
                Not a criticism. It&apos;s just that making something people pay for is a second
                job, and you already have one.
              </p>
            </div>

            <div className="tries rise">
              <div className="try">
                <h3>Brand deals</h3>
                <p>Paid once. Then you&apos;re back in the DMs pitching the next one.</p>
              </div>
              <div className="try">
                <h3>Affiliate links</h3>
                <p>A few percent of something you didn&apos;t make, for an audience you did.</p>
              </div>
              <div className="try">
                <h3>The course</h3>
                <p>Module 3 has been &quot;almost done&quot; since spring.</p>
              </div>
              <div className="try">
                <h3>Course platforms</h3>
                <p>You paid $99 and got a blank page and a login.</p>
              </div>
            </div>

            <div className="punch rise">
              <Yuzu className="yz-punch" size={54} mood="wow" tilt={9} float floatDuration={4.6} />
              <div className="punch-side old">
                <span className="big">~20h</span>
                <span className="lbl">To build it yourself</span>
              </div>
              <span className="punch-vs">vs</span>
              <div className="punch-side win">
                <span className="big">~20min</span>
                <span className="lbl">To build it with us</span>
              </div>
            </div>
          </div>
        </section>

        <section id="how">
          <div className="wrap">
            <div className="section-head rise">
              <p className="eyebrow">Your digital product live in 20 minutes</p>
              <h2>Earn regular income from your audience</h2>
            </div>

            <div className="steps">
              <div className="step rise">
                <span className="num">01</span>
                <div>
                  <h3>Hand over the handle</h3>
                </div>
                <div className="step-body">
                  <p>
                    Yuzuu reads your captions and comments to learn what your audience keeps asking
                    for, in the words they use.
                  </p>
                </div>
              </div>

              <div className="step rise">
                <span className="num">02</span>
                <div>
                  <h3>Pick the idea you like</h3>
                </div>
                <div className="step-body">
                  <p>
                    You get three ideas, each with a promise, a price and the receipts — the
                    comments that prove people want it. Plus one wild card. Pick one. Or throw all
                    four back and we go again.
                  </p>
                </div>
              </div>

              <div className="step rise">
                <span className="num">03</span>
                <div>
                  <h3>We build the product</h3>
                </div>
                <div className="step-body">
                  <p>
                    Research, quiz, buyer types, content bank, sales page, checkout. Every stage
                    scored and rejected until it passes. Go do your day.
                  </p>
                </div>
              </div>

              <div className="step rise">
                <span className="num">04</span>
                <div>
                  <h3>Review three samples, then go live</h3>
                </div>
                <div className="step-body">
                  <p>
                    Three full plans for three different buyers land in your inbox. Read them like
                    one of your followers would. Approve, and your page goes live. Reject, tell us
                    why in a sentence, and it rebuilds. Nothing publishes without your yes.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="buyer">
          <div className="wrap">
            <div className="section-head rise">
              <p className="eyebrow">What your buyer gets</p>
              <h2>Two people, same $27, two different documents.</h2>
              <p className="lede">
                Your follower takes the quiz, pays, and ninety seconds later reads a plan written
                around those answers. Here&apos;s the same product, two buyers.
              </p>
            </div>

            <div className="swap">
              <article className="person rise">
                <header>
                  <h3>Maya, 34</h3>
                  <span>Falls asleep fine, wakes at 3am, two kids</span>
                </header>
                <dl className="qa">
                  <dt>Hardest part</dt>
                  <dd>Waking in the night</dd>
                  <dt>Evenings look like</dt>
                  <dd>Bedtime routine until 9:30, then work</dd>
                  <dt>Has tried</dt>
                  <dd>Magnesium, blackout blinds</dd>
                </dl>
                <div className="plan">
                  <h4>Her plan opens with</h4>
                  <ul>
                    <li>A 3am protocol: what to do in the first four minutes awake</li>
                    <li>Week 1 built around a 9:30 start, not a 7pm one</li>
                    <li>Skips the magnesium chapter — she&apos;s already there</li>
                  </ul>
                </div>
              </article>

              <article className="person rise">
                <header>
                  <h3>Tom, 27</h3>
                  <span>Can&apos;t switch off, phone in bed, works late shifts</span>
                </header>
                <dl className="qa">
                  <dt>Hardest part</dt>
                  <dd>Falling asleep at all</dd>
                  <dt>Evenings look like</dt>
                  <dd>Home at 11pm, wired</dd>
                  <dt>Has tried</dt>
                  <dd>Nothing yet</dd>
                </dl>
                <div className="plan">
                  <h4>His plan opens with</h4>
                  <ul>
                    <li>A wind-down that starts at 11pm, because that&apos;s when he gets home</li>
                    <li>Phone rules he&apos;ll actually keep, phased over ten days</li>
                    <li>A shift-work chapter Maya never sees</li>
                  </ul>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section id="quality">
          <div className="wrap">
            <div className="section-head rise">
              <p className="eyebrow">The part that&apos;s hard to fake</p>
              <h2>&quot;Couldn&apos;t I just do this with ChatGPT?&quot;</h2>
              <p className="lede">
                You could get a draft. What you can&apos;t get in an afternoon is a product that
                holds up across a thousand different buyers — because that work happens before
                anyone buys, and it happens once.
              </p>
            </div>

            <div className="gates">
              <div className="gate rise">
                <span className="tag">Evidence</span>
                <h3>Every claim traces to your audience</h3>
                <p>
                  If your followers never said it, it doesn&apos;t go in. Nothing gets invented to
                  fill a page.
                </p>
              </div>
              <div className="gate rise">
                <span className="tag">The swap test</span>
                <h3>Different buyers, different plans</h3>
                <p>
                  We compare generated plans against each other. Not different enough, and the
                  build goes back to the drawing board.
                </p>
              </div>
              <div className="gate rise">
                <span className="tag">No filler</span>
                <h3>Every question changes something</h3>
                <p>
                  If an answer doesn&apos;t visibly change a section of the plan, the question gets
                  cut. Quizzes that ask for nothing are how people learn to distrust them.
                </p>
              </div>
              <div className="gate rise">
                <span className="tag">Safety</span>
                <h3>Health, money and legal get a stricter pass</h3>
                <p>
                  No diagnoses, no guaranteed outcomes, no advice that should come from a
                  professional. Your name is on it.
                </p>
              </div>
              <div className="gate rise">
                <span className="tag">Frozen at launch</span>
                <h3>Nothing is improvised at checkout</h3>
                <p>
                  The product is locked before it goes live. At purchase, the model writes from
                  that locked brief — it isn&apos;t inventing your product while a buyer waits.
                </p>
              </div>
              <div className="gate rise">
                <span className="tag">We say no</span>
                <h3>Some accounts get declined</h3>
                <p>
                  If the material isn&apos;t there, we tell you and build nothing. A bad product
                  with your face on it costs you more than no product.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="money">
          <div className="wrap">
            <div className="section-head rise">
              <p className="eyebrow">The money</p>
              <h2>We only get paid when you do.</h2>
              <p className="lede">
                The build costs real money in compute. We cover it. If your product never sells, we
                ate that — which is the strongest reason you&apos;ll ever get to believe we
                won&apos;t ship you something weak.
              </p>
            </div>

            <div className="money">
              <div className="split rise">
                <div className="row">
                  <span className="k">Cost to build</span>
                  <span className="v hot">$0</span>
                </div>
                <div className="row">
                  <span className="k">You keep, per sale</span>
                  <span className="v">{CREATOR_KEEP_PCT}%</span>
                </div>
                <div className="row">
                  <span className="k">We keep</span>
                  <span className="v">{PLATFORM_KEEP_PCT}%</span>
                </div>
                <div className="row">
                  <span className="k">Monthly fee</span>
                  <span className="v">None</span>
                </div>
                <div className="row">
                  <span className="k">Minimum term</span>
                  <span className="v">None</span>
                </div>
                <p className="later" style={{ color: "rgba(251, 252, 245, 0.62)" }}>
                  Split is on the price before tax — card fees come out of our side, not yours.
                  Refunds come out of both sides the same way. Paid out monthly from $50.
                </p>
              </div>

              <div className="owns rise">
                <h3>What&apos;s yours, permanently</h3>
                <ul>
                  <li>The product. It&apos;s built from your material and your voice.</li>
                  <li>The buyer list. Export it whenever you want, no ask.</li>
                  <li>The right to leave. Walk away with the list and the last build.</li>
                </ul>
                <a className="btn btn-peel owns-cta" href="#claim">
                  Claim a build
                </a>
              </div>
            </div>
          </div>
        </section>

        <section id="fit">
          <div className="wrap">
            <div className="section-head rise">
              <p className="eyebrow">Honest fit</p>
              <h2>This doesn&apos;t work for everyone yet.</h2>
            </div>
            <div className="fit">
              <div className="fit-col fit-yes rise">
                <h3>
                  <Yuzu className="yz-fit" size={26} mood="joy" />
                  It works when
                </h3>
                <ul>
                  <li>Your comments and DMs are full of people describing their own situation</li>
                  <li>
                    Your topic fits &quot;here&apos;s where you are, here&apos;s your next 30
                    days&quot; — sleep, habits, training, language, money, plants, focus,
                    confidence
                  </li>
                  <li>You&apos;d be comfortable putting your name on a document you didn&apos;t type</li>
                  <li>You&apos;ll actually post about it once it&apos;s live</li>
                </ul>
              </div>
              <div className="fit-col fit-no rise">
                <h3>Not yet when</h3>
                <ul>
                  <li>Your niche is software tutorials or anything that needs screens and steps</li>
                  <li>You sell physical products and want this to be one</li>
                  <li>Your audience watches but never asks — big numbers, no questions</li>
                  <li>
                    You want to art-direct the page. Every Yuzuu page looks the same on purpose.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section id="faq">
          <div className="wrap">
            <div className="section-head rise">
              <p className="eyebrow">Questions you should be asking</p>
              <h2>Straight answers.</h2>
            </div>
            <div className="faq rise">
              {LANDING_FAQ.map((item) => (
                <details key={item.q}>
                  <summary>{item.q}</summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="closer" id="claim">
          <div className="wrap">
            <p className="eyebrow" style={{ color: "var(--peel)" }}>
              Nothing to lose
            </p>
            <h2>
              Give us twenty minutes. <span>We give you a full product to earn money.</span>
            </h2>
            <p className="lede">
              You&apos;ll know within a few minutes whether there&apos;s a product in your
              audience. If there isn&apos;t, we&apos;ll tell you that instead of selling you
              something.
            </p>
            <HandleForm inputId="handle-foot" peel />
          </div>
          <div className="yz-closer" aria-hidden="true">
            <Yuzu size={92} mood="happy" tilt={-7} float floatDuration={6.2} />
            <Yuzu size={58} mood="wink" tilt={8} flip float floatDuration={5} />
          </div>
        </section>
        </main>

        <footer>
          <div className="wrap foot">
            <Wordmark href="#top" size={17} />
            <span className="sp">© 2026 Yuzuu</span>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </div>
        </footer>
      </HandleProvider>
    </div>
  );
}
