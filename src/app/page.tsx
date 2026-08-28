import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSignedInUser } from "@/lib/auth";
import { Wordmark } from "@/components/Wordmark";
import {
  HandleForm,
  HandleProvider,
  LiveHandle,
  RiseObserve,
} from "@/components/landing/HandleSync";
import "./landing.css";

export const metadata: Metadata = {
  title: "Yuzuu — we build the product your audience keeps asking for",
  description:
    "Hand us your Instagram handle. We build the whole product — sales page, quiz, and a plan written for each buyer. You show up twice. About 20 minutes of your time.",
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  // Fallback for OAuth providers that land the `code` on the bare homepage
  // instead of /auth/callback (happens when the redirect URL used at
  // sign-in isn't in Supabase's allow-listed Redirect URLs) — forward it so
  // sign-in still completes instead of silently failing.
  const { code } = await searchParams;
  if (code) redirect(`/auth/callback?code=${encodeURIComponent(code)}&next=/onboard`);

  const user = await getSignedInUser();
  if (user) redirect("/dashboard");

  return (
    <div className="peel">
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
            <a className="btn btn-peel" href="#claim">
              Claim a build
            </a>
          </div>
        </nav>

        <header className="hero" id="top">
          <div className="wrap hero-grid">
            <div>
              <p className="eyebrow">For Instagram creators · 10k–1M</p>
              <h1>
                Earn <em>regular income</em> from your audience
              </h1>
              <p className="hero-sub">
                Yuzuu studies your audience, proposes product ideas, and builds the whole thing:
                quiz, sales page, personalized output. It costs you nothing and you keep 70% of
                every sale!
              </p>
              <HandleForm id="start" inputId="handle-hero" />
            </div>

            <div>
              <div className="preview">
                <div className="bar">
                  <span className="pip" />
                  <span className="pip" />
                  <span className="pip" />
                  <span className="url">
                    yuzuu.co/u/
                    <b>
                      <LiveHandle />
                    </b>
                  </span>
                </div>
                <div className="preview-body">
                  <p className="pv-eyebrow">
                    by @
                    <LiveHandle />
                  </p>
                  <h3 className="pv-title">The 30-Day Sleep Reset, written for your nights</h3>
                  <p className="pv-p">
                    Six questions about how you actually sleep. Then a day-by-day plan built
                    around your answers — not a PDF with your name at the top.
                  </p>
                  <div className="pv-cta">
                    <span className="pv-price">$27</span>
                    <span className="pv-btn">Start the quiz →</span>
                  </div>
                  <div className="chips">
                    <span className="chip">Your wind-down</span>
                    <span className="chip">Week 1 · nights 1–7</span>
                    <span className="chip">If you wake at 3am</span>
                    <span className="chip">Shift work</span>
                  </div>
                </div>
              </div>
              <p className="caption">Type your handle — this is the page we&apos;d host for you.</p>
            </div>
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
              <p className="eyebrow">Four steps · two are yours</p>
              <h2>What actually happens after you type your handle.</h2>
            </div>

            <div className="steps">
              <div className="step rise">
                <span className="num">01</span>
                <div>
                  <span className="who who-you">Yours · 2 min</span>
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
                  <span className="who who-you">Yours · 5 min</span>
                  <h3>Pick the product</h3>
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
                  <span className="who who-us">Ours · a few hours</span>
                  <h3>We build the whole thing</h3>
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
                  <span className="who who-you">Yours · 15 min</span>
                  <h3>Read three samples, then go live</h3>
                </div>
                <div className="step-body">
                  <p>
                    Three full plans for three different buyers land in your inbox. Read them like
                    one of your followers would. Approve, and your page goes live. Reject, tell us
                    why in a sentence, and it rebuilds. Nothing publishes without your yes.
                  </p>
                  <span className="time">
                    Then: your link, your sales, your buyer list, on one dashboard.
                  </span>
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
                  <span className="v">75%</span>
                </div>
                <div className="row">
                  <span className="k">We keep</span>
                  <span className="v">25%</span>
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
                  Split is on net, after card fees. Refunds come out of both sides the same way.
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
                <h3>It works when</h3>
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
              <details>
                <summary>How much of my time is this, really?</summary>
                <p>
                  About twenty minutes, split across two sittings a few hours apart. Two minutes to
                  hand over your handle, five to pick the idea, and roughly fifteen to read three
                  sample plans properly. If you skim the samples, don&apos;t do this.
                </p>
              </details>
              <details>
                <summary>Do you post as me, or touch my account?</summary>
                <p>
                  No. We read your public posts and comments. We never log in as you, never message
                  anyone, never publish anything on your account.
                </p>
              </details>
              <details>
                <summary>What if I hate what you build?</summary>
                <p>
                  Say so and give us one sentence about why. It rebuilds. Nothing goes live without
                  you approving three real samples — and if you never approve, nothing ever goes
                  live and you&apos;ve paid nothing.
                </p>
              </details>
              <details>
                <summary>What does my buyer actually receive?</summary>
                <p>
                  A written plan on the web, at a private link, generated from their quiz answers
                  in about ninety seconds. Prose, checklists, week-by-week timelines, tables. They
                  can save it as a PDF from their browser, and the link is emailed to them.
                </p>
              </details>
              <details>
                <summary>Why $27?</summary>
                <p>
                  It&apos;s the price where people buy on the spot without asking a partner. You
                  can go higher once you have sales — but the first product should sell, not
                  impress.
                </p>
              </details>
              <details>
                <summary>Can I run more than one product?</summary>
                <p>One per creator for now. We&apos;d rather have one that sells than three that half-work.</p>
              </details>
              <details>
                <summary>Who&apos;s behind this?</summary>
                <p>
                  A small team that built this exact funnel by hand, repeatedly, before turning it
                  into a product. That&apos;s why the quality checks are strict — we know precisely
                  where these things go wrong.
                </p>
              </details>
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
        </section>

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
