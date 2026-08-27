import Link from "next/link";
import { redirect } from "next/navigation";
import { getSignedInUser } from "@/lib/auth";
import { BuildConsole } from "@/components/landing/BuildConsole";
import { SegmentWheel } from "@/components/landing/SegmentWheel";
import "./landing.css";

function Logo({ small }: { small?: boolean }) {
  return (
    <Link href="/" className="logo">
      <span className="fruit" />
      <span className="word" style={small ? { fontSize: "1.1rem" } : undefined}>
        yuzuu
      </span>
    </Link>
  );
}

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
    <div className="rind">
      <nav>
        <div className="wrap nav-in">
          <Logo />
          <div className="nav-links">
            <a href="#how">How it works</a>
            <a href="#quality">Quality</a>
            <a href="#pricing">Pricing</a>
            <Link href="/auth">Sign in</Link>
            <Link href="/auth" className="btn btn-sm">
              Start with your handle
            </Link>
          </div>
        </div>
      </nav>

      <section className="hero">
        <div className="wrap hero-grid">
          <div>
            <span className="kicker">First 50 creators · free build</span>
            <h1 style={{ marginTop: "1.3rem" }}>
              You have an audience. You don&apos;t have <em>a business.</em>
            </h1>
            <p className="lede" style={{ marginTop: "1.5rem" }}>
              Yuzuu studies your audience, proposes product ideas,
              and builds the whole thing: quiz, sales page, personalized output. It costs you nothing and you keep 70% of
              every sale! 
            </p>
            <div className="hero-actions">
              <Link href="/auth" className="btn">
                Start with your handle
              </Link>
              <a href="#how" className="btn ghost">
                See how it works
              </a>
            </div>
            <p className="hero-note">No fee · No credit card required (AT ALL)</p>
          </div>
          <BuildConsole />
        </div>
      </section>

      <section className="reassure">
        <div className="wrap">
          <div className="reassure-grid">
            <div className="reassure-item">
              <span className="r-num">01</span>
              <h3>No build fee</h3>
              <p>We build the whole thing first. You only pay a share once it actually sells.</p>
            </div>
            <div className="reassure-item">
              <span className="r-num">02</span>
              <h3>You own it all</h3>
              <p>Your Stripe account, your buyer list, exportable any day you want.</p>
            </div>
            <div className="reassure-item">
              <span className="r-num">03</span>
              <h3>Nothing ships blind</h3>
              <p>Three real samples, your name on them — you approve before anyone sees it.</p>
            </div>
            <div className="reassure-item">
              <span className="r-num">04</span>
              <h3>Leave whenever</h3>
              <p>No contract, no lock-in. Cancel any time and keep your list and your last build.</p>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="narrow" style={{ margin: 0 }}>
            <div className="tag-rule">
              <span className="n">01</span> Where creators get stuck
            </div>
            <h2>Every path to real income asks you to become a second business.</h2>
          </div>
          <div className="problem-list">
            <div>
              <span className="n">01</span>
              <p>Brand deals pay once, then you&apos;re back to zero and pitching again.</p>
            </div>
            <div>
              <span className="n">02</span>
              <p>Affiliate links pay 4% of something you didn&apos;t make and can&apos;t improve.</p>
            </div>
            <div>
              <span className="n">03</span>
              <p>The course you started in January is still 40% recorded, and you know it.</p>
            </div>
            <div>
              <span className="n">04</span>
              <p>The tools (Kajabi, Gumroad, Systeme) all hand you an empty page and wish you luck.</p>
            </div>
          </div>
          <p className="turn">
            Making a product people pay for is roughly <mark>200 hours</mark> of work you
            don&apos;t have.
          </p>
          <p className="lede" style={{ marginTop: "1.6rem" }}>
          The audience is ready. The product just never gets made.
          </p>
        </div>
      </section>

      <section id="how" style={{ background: "var(--paper-2)" }}>
        <div className="wrap">
          <div className="narrow" style={{ margin: 0 }}>
            <div className="tag-rule">
              <span className="n">02</span> The Solution
            </div>
            <h2>We make the product for you. At our cost.</h2>
            <p className="lede">
            The kind where your follower answers a few questions and gets something written for their exact situation, not a generic PDF. 

You stay in control at the two moments that matter. Everything else is ours.


      </p>
          </div>
          <div className="steps">
            <div className="step yours">
              <span className="k">STEP 1 — YOURS</span>
              <h3>Hand over your handle</h3>
              <p>
                Yuzuu reads your captions and comments to learn what your audience keeps asking
                for, in the words they use.
              </p>
              <span className="time">~2 min</span>
            </div>
            <div className="step yours">
              <span className="k">STEP 2 — YOURS</span>
              <h3>Pick your product</h3>
              <p>
                Five topics, each with a promise, a price and a reason it fits. Choose one — or
                reject them all and get more.
              </p>
              <span className="time">~5 min</span>
            </div>
            <div className="step">
              <span className="k">STEP 3 — OURS</span>
              <h3>Yuzuu builds it</h3>
              <p>
                Research, quiz, buyer types, content bank, sales page, checkout. Every stage
                scored and rejected until it passes.
              </p>
              <span className="time">4–6 h, hands off</span>
            </div>
            <div className="step yours">
              <span className="k">STEP 4 — YOURS</span>
              <h3>Sign off, go live</h3>
              <p>
                Three sample outputs, three different buyer types. If they don&apos;t sound like
                you, it doesn&apos;t ship.
              </p>
              <span className="time">~15 min</span>
            </div>
          </div>
        </div>
      </section>

      <section className="delivery">
        <div className="wrap">
          <div className="narrow" style={{ margin: 0 }}>
            <div className="tag-rule">
              <span className="n">03</span> What your follower sees
            </div>
            <h2>Quiz to their inbox in under four minutes.</h2>
          </div>
          <div className="flow">
            <div className="f">
              <span className="lab">00:00</span>
              <h3>They take the quiz</h3>
              <p>Eight to twelve questions on your page. Every answer changes what gets written.</p>
            </div>
            <div className="f">
              <span className="lab">02:10</span>
              <h3>They pay</h3>
              <p>Stripe checkout, $27 by default. Your account, your money, split handled automatically.</p>
            </div>
            <div className="f">
              <span className="lab">03:30</span>
              <h3>Their plan arrives</h3>
              <p>Written for their situation, not their category. In their inbox in under 90 seconds.</p>
            </div>
          </div>
          <div className="sample narrow">
            <div className="stripe" />
            <h3>The 30-Day Wake-Up Reset</h3>
            <div className="sub">built for: light sleeper · 2am waker · shift worker · 34</div>
            <p className="body">
              <b>Why you keep waking at 2am.</b> You&apos;re not a bad sleeper. You&apos;re
              falling asleep at a body temperature that&apos;s too high, which means your first
              deep block ends early — and once it ends, the smallest noise ends the night.
              Rotating shifts make this worse because your temperature curve never gets a fixed
              anchor. So we&apos;re not going to work on falling asleep. You do that fine.
              We&apos;re going to work on the four hours before it, and on one fixed anchor your
              body can hold onto even when your schedule can&apos;t.{" "}
              <b>Day 1 starts tonight, and it takes eleven minutes.</b>
            </p>
            <div className="meta">
              <span>4,180 words</span>
              <span>30 days</span>
              <span>segment 01 of 14</span>
              <span>generated in 71s</span>
            </div>
          </div>
        </div>
      </section>

      <section id="quality" className="quality">
        <div className="wrap">
          <div className="narrow" style={{ margin: 0 }}>
            <div className="tag-rule">
              <span className="n">04</span> The part nobody else does
            </div>
            <h2>Nothing reaches you until it&apos;s been rejected at least once.</h2>
            <p className="lede">
              Anyone can point an AI at a niche and get a PDF back in thirty seconds. That&apos;s
              why most AI products feel cheap — nothing ever tells the model no. Before a build
              ever reaches you, it has to survive four checks built to catch exactly what makes
              AI content feel fake.
            </p>
          </div>

          <div className="gates">
            <div className="gate">
              <span className="g-num">CHECK 01</span>
              <h3>Nothing invented</h3>
              <p>
                Every claim has to trace back to something real your audience said — not a guess
                the model made up. If it can&apos;t be traced, it&apos;s cut before a buyer ever
                sees it.
              </p>
            </div>
            <div className="gate">
              <span className="g-num">CHECK 02</span>
              <h3>No filler questions</h3>
              <p>
                Every quiz question has to change what the buyer gets. If a question is only
                there to decorate the experience, it&apos;s deleted.
              </p>
            </div>
            <div className="gate">
              <span className="g-num">CHECK 03</span>
              <h3>The swap test</h3>
              <p>
                We take one buyer&apos;s plan and hand it to a different buyer. If it still fits
                them too, the personalization is fake — the whole build is rejected and rebuilt.
              </p>
            </div>
            <div className="gate">
              <span className="g-num">CHECK 04</span>
              <h3>Safe to sell</h3>
              <p>
                Health, money and legal topics get a stricter pass: no promises, no diagnoses,
                referral language where it belongs.
              </p>
            </div>

            <div className="gate human">
              <div className="human-in">
                <div className="seal" aria-hidden="true">
                  <svg viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="57" fill="none" stroke="#0F1F17" strokeWidth="1.5" />
                    <circle cx="60" cy="60" r="44" fill="none" stroke="#0F1F17" strokeWidth="1" />
                    <g className="ring">
                      <path id="sealpath" d="M60 10 a50 50 0 1 1 -0.1 0" fill="none" />
                      <text fontSize="7.2" letterSpacing="2.4" fill="#0F1F17" style={{ fontFamily: "var(--l-mono)" }}>
                        <textPath href="#sealpath" startOffset="0">
                          APPROVED BY THE CREATOR · NOT BY THE MACHINE ·{" "}
                        </textPath>
                      </text>
                    </g>
                    <text x="60" y="57" textAnchor="middle" fontSize="8" fill="#0F1F17" style={{ fontFamily: "var(--l-mono)" }}>
                      3/3
                    </text>
                    <text x="60" y="70" textAnchor="middle" fontSize="6" fill="#2F6B4F" style={{ fontFamily: "var(--l-mono)" }}>
                      SAMPLES
                    </text>
                  </svg>
                </div>
                <div className="txt">
                  <span className="g-num">CHECK 05 — YOU</span>
                  <h3>The one we can&apos;t automate</h3>
                  <p>
                    Three samples, three different buyer types, your name on the front. Nothing
                    ships until you say it sounds like you.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <p className="cap" style={{ marginTop: "1.6rem" }}>
            On average, two builds get rejected internally before one reaches a creator — that&apos;s
            the normal number, not a bug.
          </p>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="narrow" style={{ margin: 0 }}>
            <div className="tag-rule">
              <span className="n">05</span> What personalization actually means
            </div>
            <h2>Everyone buys the same product. Nobody gets the same answer.</h2>
            <p className="lede">
              Your buyers don&apos;t split into beginner, intermediate and advanced — they split
              by what&apos;s actually wrong. The quiz figures out which, then writes for that
              problem specifically: its own diagnosis, its own first week, its own
              troubleshooting.
            </p>
          </div>
          <SegmentWheel />
          <p className="cap">
            Hover a segment. Same product, same price, same page — a different diagnosis, not a
            different name inserted.
          </p>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="narrow" style={{ margin: 0 }}>
            <div className="tag-rule">
              <span className="n">06</span> Your side of it
            </div>
            <h2>You get a business, not a folder of files.</h2>
          </div>
          <div className="cols">
            <div>
              <h3>What comes with the build</h3>
              <ul className="tick">
                <li>
                  <b>Your page</b> — yuzuu.co/u/yourname, or your own domain
                </li>
                <li>
                  <b>Your own Stripe account</b> — buyers pay you, the split happens automatically
                </li>
                <li>
                  <b>Your email list</b> — every buyer is yours, exportable any day
                </li>
                <li>
                  <b>The order emails</b> — delivery, receipts, follow-ups, written
                </li>
                <li>
                  <b>A dashboard</b> — sales, conversion, where buyers drop off
                </li>
                <li>
                  <b>Rebuilds</b> — outgrow the product, rebuild it, keep the list
                </li>
              </ul>
            </div>
            <div>
              <h3>One design, and you can&apos;t change it</h3>
              <p className="note-p" style={{ marginTop: "1.2rem" }}>
                Every Yuzuu page looks the same right now. That&apos;s on purpose, and it&apos;s
                the honest tradeoff of the early version.
              </p>
              <p className="note-p">
                The quiz and checkout have been tested on live traffic across three products.
                Handing you colour pickers would let you break a page that converts, and would
                cost us the ability to improve it for everyone at once.
              </p>
              <p className="note-p" style={{ margin: 0 }}>
                Your logo, your name, your voice, your domain. Not your layout — yet.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section style={{ background: "var(--paper-2)" }}>
        <div className="wrap">
          <div className="narrow" style={{ margin: 0 }}>
            <div className="tag-rule">
              <span className="n">07</span> Where this sits
            </div>
            <h2>The tools sell you shelves. Yuzuu makes the thing on them.</h2>
          </div>
          <div className="tbl-scroll">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Route</th>
                  <th>You supply</th>
                  <th>Time to live</th>
                  <th>Ongoing work</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Gumroad / Systeme</td>
                  <td>The whole product</td>
                  <td>Weeks — if you finish</td>
                  <td>All of it</td>
                </tr>
                <tr>
                  <td>Course platform</td>
                  <td>Script, filming, editing</td>
                  <td>2–3 months</td>
                  <td>Updates, support, refunds</td>
                </tr>
                <tr>
                  <td>Hiring a ghostwriter</td>
                  <td>$4k–$12k and a brief</td>
                  <td>4–8 weeks</td>
                  <td>One static PDF, forever</td>
                </tr>
                <tr>
                  <td>ChatGPT and a PDF</td>
                  <td>An afternoon</td>
                  <td>Same day</td>
                  <td>Refunds, mostly</td>
                </tr>
                <tr className="us">
                  <td>Yuzuu</td>
                  <td>A handle and 20 minutes</td>
                  <td>Under a week</td>
                  <td>Post about it</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section id="pricing">
        <div className="wrap">
          <div className="narrow" style={{ margin: 0 }}>
            <div className="tag-rule">
              <span className="n">08</span> Pricing
            </div>
            <h2>You keep 75%. We only get paid when you do.</h2>
            <p className="lede">
              No build fee, no monthly minimum, no contract. If your product never sells,
              you&apos;ve paid us nothing — which is the point. It keeps us responsible for
              whether the thing works, not just for shipping it.
            </p>
          </div>
          <div className="price-grid">
            <div className="plan featured">
              <span className="name">Launch</span>
              <div className="amt">
                75<small>% to you</small>
              </div>
              <p className="note">
                $0 to build. We take 25% of net sales. Full pipeline, your page, your list, your
                buyers. Nothing up front, ever.
              </p>
              <Link href="/auth" className="btn">
                Start with your handle
              </Link>
            </div>
            <div className="plan">
              <span className="name">Scale</span>
              <div className="amt">
                90<small>% to you</small>
              </div>
              <p className="note">
                $99/month buys the share down to 10%. Worth it past roughly 25 sales a month —
                switch whenever the maths turns, we&apos;ll tell you when.
              </p>
              <Link href="/auth" className="btn ghost">
                Start with your handle
              </Link>
            </div>
          </div>
          <p className="cap">
            Split is on net — card fees come off the top before we take anything. Payouts daily
            via Stripe. Refunds shared the same 75/25. Leave whenever, keep your list.
          </p>
        </div>
      </section>

      <section style={{ background: "var(--paper-2)" }}>
        <div className="wrap">
          <div className="narrow" style={{ margin: 0 }}>
            <div className="tag-rule">
              <span className="n">09</span> Before you ask
            </div>
            <h2>The six things everyone asks.</h2>
          </div>
          <div className="faq">
            <details open>
              <summary>Is this just ChatGPT with a nicer wrapper?</summary>
              <p>
                No, and the difference is the build phase. Most AI products ask a model to invent
                a product while a customer waits thirty seconds. Yuzuu spends hours up front
                researching, drafting and rejecting until a blueprint passes every check — then
                freezes it. At purchase time the model isn&apos;t deciding what your product is.
                It&apos;s writing from a brief that already passed. That&apos;s why quality
                doesn&apos;t wobble from buyer to buyer.
              </p>
            </details>
            <details>
              <summary>Will it sound like me or like a robot?</summary>
              <p>
                It learns your vocabulary, your recurring points and how you talk to your audience
                from your own posts, and voice match is one of the scored criteria. But you&apos;re
                the final gate: three samples, and if they don&apos;t sound like you, they
                don&apos;t ship. Send them back as many times as you need.
              </p>
            </details>
            <details>
              <summary>What if my niche is weird or very small?</summary>
              <p>
                Small and specific is usually better — the personalization has more to grip. The
                real constraint is topic type: Yuzuu builds personalized transformation plans, so
                anything shaped like &quot;here&apos;s your situation, here&apos;s your 30
                days&quot; works. Something shaped like a software tutorial or a physical product
                doesn&apos;t, yet.
              </p>
            </details>
            <details>
              <summary>Who owns the product and the buyers?</summary>
              <p>
                You own both. Your name on the product, your Stripe account, your customer list,
                exportable whenever you want. If you leave, you keep the list and the last version
                of the content.
              </p>
            </details>
            <details>
              <summary>How big does my audience need to be?</summary>
              <p>
                Engagement matters more than size. Around 10,000 engaged followers is enough to
                test with, and this works best between 50k and 1M with an audience that asks you
                questions rather than just watching. If people DM you for advice, that&apos;s the
                signal.
              </p>
            </details>
            <details>
              <summary>What does it actually cost me if it flops?</summary>
              <p>
                Your time — about twenty minutes across the build — and nothing else. There&apos;s
                no build fee, so a product that never sells costs you nothing beyond the afternoon
                you spent posting about it. We carry the build cost, which is exactly why we
                won&apos;t ship you a product we don&apos;t think will sell.
              </p>
            </details>
          </div>
        </div>
      </section>

      <section id="apply" className="cta">
        <div className="halo" />
        <div className="wrap" style={{ position: "relative" }}>
          <h2>The first 50 builds are free.</h2>
          <p>
            Fifty creators in the first cohort. We build with you directly and use what breaks to
            make the pipeline better. No fee, no lock-in — you keep 75% of everything it makes.
          </p>
          <Link href="/auth" className="btn yuzu">
            Start with your handle
          </Link>
          <div className="seats">31 of 50 places open · reviewed within 48h</div>
        </div>
      </section>

      <footer>
        <div className="wrap footer-in">
          <Logo small />
          <span>
            © 2026 ·{" "}
            <a href="/privacy" target="_blank" rel="noopener noreferrer">
              Privacy
            </a>{" "}
            ·{" "}
            <a href="/terms" target="_blank" rel="noopener noreferrer">
              Terms
            </a>{" "}
            · hello (at) yuzuu (dot) co
          </span>
        </div>
      </footer>
    </div>
  );
}
