import type { Metadata } from "next";
import Link from "next/link";
import { Bricolage_Grotesque, DM_Mono } from "next/font/google";
import { Wordmark } from "@/components/Wordmark";
import { Yuzu } from "@/components/Yuzu";
import { JsonLd } from "@/components/JsonLd";
import { RiseObserve, WaitlistForm } from "@/components/landing/Waitlist";
import { HeroDemo } from "@/components/landing/HeroDemo";
import { LANDING_FAQ, faqPageJsonLd } from "@/lib/landing-faq";
import { TRADES } from "@/lib/trades";
import { SITE_DESCRIPTION, SITE_TITLE, canonical } from "@/lib/seo";
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

/** The four journeys every home-service business needs, in the order a
 * visitor meets them in the hero demo. */
const JOURNEYS = [
  {
    tag: "Fixed price",
    name: "Standard service",
    eg: "Annual boiler service, sofa cleaning, chimney sweep",
    flow: ["Questions", "Price by your rules", "Slot", "Payment or deposit", "Job"],
  },
  {
    tag: "Diagnosis",
    name: "Diagnose first",
    eg: "Breakdown, leak, faulty appliance",
    flow: ["Qualify", "Call-out terms", "Slot request", "Confirmation", "Diagnosis"],
  },
  {
    tag: "Quote",
    name: "Project on quote",
    eg: "Air conditioning install, painting, renovation",
    flow: ["Photos & details", "Site visit if needed", "Quote", "Follow-ups", "Signature & deposit", "Planning"],
  },
  {
    tag: "Recurring",
    name: "Recurring service",
    eg: "Cleaning, gardening, pool care",
    flow: ["First qualification", "Frequency", "Recurring schedule", "Visit tracking", "Billing & renewal"],
  },
] as const;

/** The case board columns, left to right, with a few believable cards each. */
const BOARD: { col: string; count: number; cards: { who: string; what: string; meta: string; note: string; tone?: "you" | "ok" }[] }[] = [
  {
    col: "New request",
    count: 3,
    cards: [
      { who: "Lucas M.", what: "Leaking tap", meta: "Northside · Diagnosis", note: "Qualifying · 2 of 4 answers" },
      { who: "Grace P.", what: "Gutter cleaning", meta: "Eastfield · Fixed price", note: "Priced by rules · $140" },
    ],
  },
  {
    col: "Missing info",
    count: 2,
    cards: [
      { who: "Omar K.", what: "Ceiling repaint", meta: "Old Town · Quote", note: "Waiting on 2 photos · nudged once" },
    ],
  },
  {
    col: "To quote",
    count: 2,
    cards: [
      { who: "Anna L.", what: "Heat pump, 3 rooms", meta: "Riverside · Quote", note: "Visit done · draft ready for you", tone: "you" },
    ],
  },
  {
    col: "To confirm",
    count: 1,
    cards: [
      { who: "Jade T.", what: "Boiler service", meta: "Northside · $119", note: "Slot offered · Thu 9:00" },
    ],
  },
  {
    col: "Planned",
    count: 6,
    cards: [
      { who: "Emma R.", what: "Sofa cleaning", meta: "Fri 14:00 · Riverside", note: "Deposit paid · reminder Thu", tone: "ok" },
      { who: "Henri D.", what: "Pool care, weekly", meta: "Mondays · visit 5 of 16", note: "Route: 3 stops, 41 min" },
    ],
  },
  {
    col: "Done",
    count: 4,
    cards: [
      { who: "Sam W.", what: "Chimney sweep", meta: "Westbrook · $95", note: "Review requested", tone: "ok" },
    ],
  },
  {
    col: "To pay",
    count: 1,
    cards: [
      { who: "Paul B.", what: "Breakdown repair", meta: "Eastfield · $310", note: "Payment link sent · day 2" },
    ],
  },
];

const FEED: { t: string; text: React.ReactNode; you?: boolean }[] = [
  { t: "07:12", text: <>Proposed 3 slots to <b>Jade T.</b>, all inside Northside and 25 min from your 8:00 job</> },
  { t: "07:40", text: <>Asked <b>Omar K.</b> for a photo of the ceiling stain, with an example of what helps</> },
  { t: "09:05", text: <>Sent quote follow-up #2 to <b>Anna L.</b> (opened twice, no reply yet)</> },
  { t: "11:30", text: <>Needs you: approve <b>Anna L.</b>’s revised quote, $6,840, above your $5k auto-send limit</>, you: true },
  { t: "13:02", text: <>Reminded <b>Emma R.</b> about Friday 14:00, parking info included</> },
  { t: "16:48", text: <>Asked <b>Sam W.</b> for a review, two hours after the job was closed</> },
  { t: "17:15", text: <>Stopped follow-ups for <b>Lucas M.</b>: he replied, the case moved on</> },
];

const ASKS = [
  "Can you come Friday?",
  "How much for a chimney sweep?",
  "Do you work weekends?",
  "The heater’s making that noise again",
  "Can I get a quote for the fence?",
  "Is 14:00 still on?",
  "Can I pay the deposit by card?",
  "Do you cover Riverside?",
  "Here are the photos you asked for",
  "Can we move it to next week?",
];

export default function Home() {
  return (
    <div className={`peel ${bricolage.variable} ${dmMono.variable}`}>
      <JsonLd data={faqPageJsonLd()} />
      <RiseObserve />

      <nav className="nav">
        <div className="wrap nav-in">
          <Wordmark href="#top" />
          <div className="nav-links">
            <a href="#how">How it works</a>
            <a href="#journeys">Journeys</a>
            <a href="#platform">Platform</a>
            <a href="#faq">FAQ</a>
          </div>
          <div className="nav-end">
            <a className="btn btn-peel" href="#join">
              Join the waitlist
            </a>
          </div>
        </div>
      </nav>

      <main>
        {/* ---------- hero ---------- */}
        <header className="hero" id="top">
          <div className="wrap hero-in">
            <Yuzu className="yz-hero" size={64} mood="happy" tilt={-8} float />
            <p className="eyebrow">Early access · for home service businesses</p>
            <h1>
              More booked jobs. <em>Less admin.</em>
            </h1>
            <p className="hero-sub">
              A client gets in touch. Yuzuu collects the right details, prices the job by your
              rules, books the slot, chases the quote and follows the case all the way to payment.
              You step in when your expertise is needed. Nowhere else.
            </p>
            <WaitlistForm inputId="email-hero" source="hero" peel />

            <p className="eyebrow showcase-label">One request, start to paid. Watch it run.</p>
            <HeroDemo />
          </div>
        </header>

        {/* ---------- problem ---------- */}
        <section id="problem">
          <div className="wrap">
            <div className="section-head rise">
              <p className="eyebrow">The job around the job</p>
              <h2>You’re great at the work. It’s everything around it that eats your week.</h2>
              <p className="lede">
                Nobody starts a plumbing business to answer texts at 10pm. Yet that’s where the
                hours go: between the call you missed and the invoice you haven’t sent.
              </p>
            </div>

            <div className="tries rise">
              <div className="try">
                <span className="try-n">01 · Inquiry</span>
                <h3>The missed call</h3>
                <p>
                  Your hands are in a boiler when the phone rings. By the time you call back,
                  they’ve booked someone else.
                </p>
              </div>
              <div className="try">
                <span className="try-n">02 · Details</span>
                <h3>The vague request</h3>
                <p>
                  “How much for a new bathroom?” Three blurry photos across three messages. No
                  address, no budget, no timing.
                </p>
              </div>
              <div className="try">
                <span className="try-n">03 · Quote</span>
                <h3>The silent quote</h3>
                <p>
                  An evening of pricing, sent. Then nothing. You’re not a salesman, so you don’t
                  chase, and the job goes to whoever calls first.
                </p>
              </div>
              <div className="try">
                <span className="try-n">04 · Payment</span>
                <h3>The job nobody invoiced</h3>
                <p>
                  The work is done. The invoice isn’t. Or it is, and it’s six weeks late, and
                  you’re the one who has to ask.
                </p>
              </div>
            </div>

            <div className="punch rise">
              <Yuzu className="yz-punch" size={54} mood="wow" tilt={9} float floatDuration={4.6} />
              <div className="punch-side old">
                <span className="big">5 tools</span>
                <span className="lbl">Phone, inbox, calendar, quotes, invoices</span>
              </div>
              <span className="punch-vs">vs</span>
              <div className="punch-side win">
                <span className="big">1 place</span>
                <span className="lbl">Where every case moves on its own</span>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- agitate ---------- */}
        <section id="mirror" className="mirror-sec">
          <div className="wrap">
            <div className="mirror rise">
              <p className="eyebrow">Sound familiar?</p>
              <p className="mirror-line">
                It’s <mark className="hl">9:40pm</mark>. You’re pricing a job from{" "}
                <mark className="hl d2">three blurry photos</mark>.
              </p>
              <p className="mirror-line dim">
                Two quotes haven’t answered in a week. One invoice is{" "}
                <mark className="hl d3">from June</mark>.
              </p>
              <p className="mirror-you">
                <span className="mirror-you-in">
                  The work followed you home.
                  <svg
                    className="mirror-rule"
                    viewBox="0 0 320 14"
                    fill="none"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M5 9.5C58 4.2 111 3.1 164 5.6c53 2.5 100 4.6 151 0.9"
                      stroke="var(--peel-deep)"
                      strokeWidth="4.5"
                      strokeLinecap="round"
                      pathLength={1}
                    />
                  </svg>
                </span>
                <Yuzu className="yz-mirror" size={46} mood="sleepy" tilt={7} float floatDuration={5.2} />
              </p>
            </div>
          </div>
        </section>

        {/* ---------- solution: the full journey ---------- */}
        <section id="how">
          <div className="wrap">
            <div className="section-head rise">
              <p className="eyebrow">The difference, start to finish</p>
              <h2>A client gets in touch. Yuzuu takes it from there.</h2>
              <p className="lede">
                The system gathers the right information, organizes what comes next and follows the
                case until it’s paid. Here’s who does what.
              </p>
            </div>

            <div className="steps">
              <div className="step rise">
                <span className="num">01</span>
                <div>
                  <h3>They get in touch</h3>
                </div>
                <div className="step-body duo">
                  <p>
                    <span className="who who-us">Yuzuu</span>
                    Answers in seconds, day or night. Asks the questions you would ask, gets the
                    address, the equipment and the missing photo.
                  </p>
                  <p>
                    <span className="who who-you">You</span>
                    Nothing yet. Keep working.
                  </p>
                </div>
              </div>

              <div className="step rise">
                <span className="num">02</span>
                <div>
                  <h3>It gets priced</h3>
                </div>
                <div className="step-body duo">
                  <p>
                    <span className="who who-us">Yuzuu</span>
                    Prices standard jobs from your rules. For projects, it books the site visit,
                    prepares the quote, then follows it up until there’s a clear yes or no.
                  </p>
                  <p>
                    <span className="who who-you">You</span>
                    Check the quotes that deserve your eye. One tap to send.
                  </p>
                </div>
              </div>

              <div className="step rise">
                <span className="num">03</span>
                <div>
                  <h3>It gets booked</h3>
                </div>
                <div className="step-body duo">
                  <p>
                    <span className="who who-us">Yuzuu</span>
                    Offers slots that fit your service area, the job’s duration, travel time, the
                    right technician and real availability.
                  </p>
                  <p>
                    <span className="who who-you">You</span>
                    Show up. The client is expecting you, and you know what you’re walking into.
                  </p>
                </div>
              </div>

              <div className="step rise">
                <span className="num">04</span>
                <div>
                  <h3>It gets done, and paid</h3>
                </div>
                <div className="step-body duo">
                  <p>
                    <span className="who who-us">Yuzuu</span>
                    Reminds the client the day before, collects the deposit or the balance, files
                    the photos on the client record and asks for a review.
                  </p>
                  <p>
                    <span className="who who-you">You</span>
                    Do the work you’re good at. Go home on time.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- four journeys ---------- */}
        <section id="journeys">
          <div className="wrap">
            <div className="section-head rise">
              <p className="eyebrow">Four journeys, built in</p>
              <h2>With or without a quote. Every kind of job gets its own path.</h2>
              <p className="lede">
                Home services don’t all sell the same way. A cleaning visit isn’t a breakdown, and a
                breakdown isn’t an installation. Yuzuu handles all four from day one.
              </p>
            </div>

            <div className="journeys">
              {JOURNEYS.map((j) => (
                <article key={j.tag} className="journey rise">
                  <span className="tag">{j.tag}</span>
                  <h3>{j.name}</h3>
                  <p className="journey-eg">{j.eg}</p>
                  <ol className="flow">
                    {j.flow.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ol>
                </article>
              ))}
            </div>

            <div className="per-service rise">
              <div className="per-copy">
                <p className="eyebrow">Per service, not per trade</p>
                <h3>The same business can use all of them.</h3>
                <p>
                  A heating engineer sells a fixed-price annual service, handles breakdowns that
                  need a diagnosis, and quotes installations. One client can go through all three
                  in the same year. So you choose the journey for each service, and the client
                  record keeps it all together.
                </p>
              </div>
              <div className="svc-frame" aria-label="Example: service settings for a heating business">
                <div className="svc-head">
                  <b>Services</b>
                  <span>Bright Heat Co.</span>
                </div>
                <div className="svc-row">
                  <span className="svc-name">
                    Annual boiler service<i>60 min · $119</i>
                  </span>
                  <span className="pill pill-a">Fixed price</span>
                </div>
                <div className="svc-row">
                  <span className="svc-name">
                    Breakdown<i>$89 call-out · off the repair</i>
                  </span>
                  <span className="pill pill-b">Diagnosis</span>
                </div>
                <div className="svc-row">
                  <span className="svc-name">
                    Heat pump installation<i>Photos + site visit</i>
                  </span>
                  <span className="pill pill-c">Quote</span>
                </div>
                <div className="svc-row">
                  <span className="svc-name">
                    Maintenance plan<i>Yearly · auto-renews</i>
                  </span>
                  <span className="pill pill-d">Recurring</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- platform: management showcase ---------- */}
        <section id="platform" className="platform-sec">
          <div className="wrap">
            <div className="section-head rise">
              <p className="eyebrow">One screen for the whole operation</p>
              <h2>Every client, every case, every visit. In one place.</h2>
              <p className="lede">
                No more digging through texts, emails and paper notes to work out where a job
                stands. Every case sits in one column, and it moves on its own.
              </p>
            </div>

            <div className="board-frame rise">
              <div className="sc-bar">
                <span className="sc-pip" />
                <span className="sc-pip" />
                <span className="sc-pip" />
                <span className="sc-url">
                  app.yuzuu.co/<b>cases</b>
                </span>
                <span className="sc-live">This week</span>
              </div>
              <div className="board-top">
                <div className="board-metrics">
                  <div>
                    <span>Booked this week</span>
                    <b>23 jobs</b>
                  </div>
                  <div>
                    <span>Quotes out</span>
                    <b>$18.4k</b>
                  </div>
                  <div>
                    <span>To collect</span>
                    <b>$1,240</b>
                  </div>
                  <div className="is-you">
                    <span>Needs you</span>
                    <b>2 items</b>
                  </div>
                </div>
              </div>
              <div className="board" tabIndex={0} aria-label="Example case board">
                {BOARD.map((c) => (
                  <div key={c.col} className="board-col">
                    <div className="board-col-head">
                      <span>{c.col}</span>
                      <i>{c.count}</i>
                    </div>
                    {c.cards.map((card) => (
                      <div key={card.who} className="card">
                        <b>{card.who}</b>
                        <span className="card-what">{card.what}</span>
                        <span className="card-meta">{card.meta}</span>
                        <span className={`card-note${card.tone ? ` is-${card.tone}` : ""}`}>
                          {card.note}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            <div className="core rise">
              <div className="core-item">
                <span className="tag">Client record</span>
                <h3>One file per client</h3>
                <p>Contact details, addresses, equipment, photos, conversations and full history.</p>
              </div>
              <div className="core-item">
                <span className="tag">Case tracking</span>
                <h3>Know where every job stands</h3>
                <p>New, missing info, to quote, to confirm, planned, done, to pay. Nothing slips.</p>
              </div>
              <div className="core-item">
                <span className="tag">Field booking</span>
                <h3>A calendar that knows the road</h3>
                <p>Service area, job duration, travel time, skills and availability, all checked.</p>
              </div>
              <div className="core-item">
                <span className="tag">Agents</span>
                <h3>Follow-up that runs itself</h3>
                <p>Missing photos, slot proposals, quote chasers, reminders and review requests.</p>
              </div>
              <div className="core-item">
                <span className="tag">Client space</span>
                <h3>A portal your clients use</h3>
                <p>Reply, send documents, accept a quote, pay and find their history.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- agents ---------- */}
        <section id="agents">
          <div className="wrap">
            <div className="section-head rise">
              <p className="eyebrow">Agents work. You do the job.</p>
              <h2>Every message answered. Every case followed up.</h2>
              <p className="lede">
                Clients write when it suits them: on the way home, on a Sunday, at 11pm. Yuzuu
                agents reply with the right answer and keep each case moving, and they stop the
                moment the client replies.
              </p>
            </div>
          </div>

          <div className="asks rise" aria-label="Examples of client messages">
            <div className="asks-track">
              {[...ASKS, ...ASKS].map((a, i) => (
                <span key={i} className="ask-pill" aria-hidden={i >= ASKS.length}>
                  “{a}”
                </span>
              ))}
            </div>
          </div>

          <div className="wrap">
            <div className="agents rise">
              <div className="feed-frame">
                <div className="feed-head">
                  <b>Agent activity</b>
                  <span>Today · 7 actions · 1 needs you</span>
                </div>
                <ul className="feed">
                  {FEED.map((f) => (
                    <li key={f.t} className={f.you ? "is-you" : undefined}>
                      <time>{f.t}</time>
                      <span>{f.text}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <ul className="agent-jobs">
                <li>
                  <span className="tag">Missing info</span>
                  Asks for the photo, the model number or the address, and explains why.
                </li>
                <li>
                  <span className="tag">Booking</span>
                  Proposes slots that actually work on your route, not just empty calendar space.
                </li>
                <li>
                  <span className="tag">Quote follow-up</span>
                  Checks in politely until there’s a yes or a no. Never a vague “just checking in.”
                </li>
                <li>
                  <span className="tag">Reminders</span>
                  Confirms the day before, with access and parking details, so you’re not knocking
                  on an empty house.
                </li>
                <li>
                  <span className="tag">Reviews</span>
                  Asks happy clients for a review at the right moment, after the job, not after the
                  invoice.
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* ---------- client space ---------- */}
        <section id="clients" className="clients-sec">
          <div className="wrap clients">
            <div className="clients-copy rise">
              <p className="eyebrow">The client side</p>
              <h2>Your clients get a space of their own.</h2>
              <p className="lede">
                No app to download, no password to forget. One link where they can follow their
                job, reply, send photos, accept a quote and pay.
              </p>
              <ul className="ticks">
                <li>Answer a question or send a document in one tap</li>
                <li>Accept a quote and pay the deposit on the spot</li>
                <li>See the date, the technician and what to prepare</li>
                <li>Find every invoice and visit report, years later</li>
              </ul>
            </div>

            <div className="phone rise" aria-label="Example: a client's space on their phone">
              <div className="phone-in">
                <div className="ph-top">
                  <span className="ph-biz">Bright Heat Co.</span>
                  <span className="ph-hi">Hi Anna</span>
                </div>
                <div className="ph-card ph-quote">
                  <span className="ph-k">Quote Q-218 · ready</span>
                  <b>Heat pump, 3 rooms</b>
                  <span className="ph-price">$6,840</span>
                  <span className="ph-btn">Accept &amp; pay $2,052 deposit</span>
                  <span className="ph-btn ghost">Ask a question</span>
                </div>
                <div className="ph-card">
                  <span className="ph-k">Next visit</span>
                  <b>Install · Mar 12, 8:00</b>
                  <span className="ph-sub">Mark + 1 · clear access to the back wall</span>
                </div>
                <div className="ph-card ph-list">
                  <span className="ph-k">Documents</span>
                  <span>📷 Site visit photos (4)</span>
                  <span>📄 Quote Q-218.pdf</span>
                  <span>🧾 Diagnosis invoice · paid</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- reliability ---------- */}
        <section id="rules">
          <div className="wrap">
            <div className="section-head rise">
              <p className="eyebrow">Why you can trust it</p>
              <h2>The AI talks. Your rules decide.</h2>
              <p className="lede">
                AI is great at understanding a messy request and keeping a conversation going. It
                shouldn’t be inventing prices or promising dates. So it doesn’t.
              </p>
            </div>

            <div className="gates">
              <div className="gate rise">
                <span className="tag">Prices</span>
                <h3>Prices come from your rules</h3>
                <p>
                  Standard jobs are priced from the rules you set: size, options, zone, urgency.
                  Never a number the AI made up.
                </p>
              </div>
              <div className="gate rise">
                <span className="tag">Availability</span>
                <h3>Slots come from your real calendar</h3>
                <p>
                  Duration, travel between jobs, team skills and service area are checked before a
                  slot is ever offered.
                </p>
              </div>
              <div className="gate rise">
                <span className="tag">Permissions</span>
                <h3>You decide what goes out alone</h3>
                <p>
                  Quotes above a limit, discounts, refunds, exceptions: they wait for your OK. You
                  set the line.
                </p>
              </div>
              <div className="gate rise">
                <span className="tag">Manners</span>
                <h3>Follow-ups stop when the client answers</h3>
                <p>
                  No reminder after they’ve paid. No chaser after they’ve said no. Persistent,
                  never pushy.
                </p>
              </div>
              <div className="gate rise">
                <span className="tag">Traceable</span>
                <h3>Every action is on the record</h3>
                <p>
                  What was sent, when, and why, saved on the client file. You can always see what
                  happened.
                </p>
              </div>
              <div className="gate rise">
                <span className="tag">Handover</span>
                <h3>You step in with full context</h3>
                <p>
                  When a case needs your expertise, it lands with the photos, the answers and the
                  history. No “can you repeat that?”
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- before / after ---------- */}
        <section id="week">
          <div className="wrap">
            <div className="section-head rise">
              <p className="eyebrow">Your week</p>
              <h2>Same trade. Same clients. Different week.</h2>
            </div>
            <div className="fit">
              <div className="fit-col fit-no rise">
                <h3>Today</h3>
                <ul>
                  <li>Replying to texts between two jobs, or from the van</li>
                  <li>Pricing at night from photos you had to ask for twice</li>
                  <li>Quotes that go quiet because chasing feels like begging</li>
                  <li>A calendar that looks free but ignores travel time</li>
                  <li>Clients who forgot you were coming</li>
                  <li>Chasing payments for work finished weeks ago</li>
                </ul>
              </div>
              <div className="fit-col fit-yes rise">
                <h3>
                  <Yuzu className="yz-fit" size={26} mood="joy" />
                  With Yuzuu
                </h3>
                <ul>
                  <li>Every request answered and qualified, even at 11pm</li>
                  <li>Standard jobs priced and booked without you</li>
                  <li>Quotes followed up until there’s a clear yes or no</li>
                  <li>Slots that fit your zone, your route and your team</li>
                  <li>Reminders out the day before, so no-shows drop</li>
                  <li>Deposits upfront and payment collected at the job</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- trades ---------- */}
        <section id="trades" className="trades-sec">
          <div className="wrap">
            <div className="section-head rise">
              <p className="eyebrow">Who it’s for</p>
              <h2>Built for the businesses that come to your door.</h2>
              <p className="lede">
                From owner-operators to growing crews. Fixed prices, call-outs, quotes or
                recurring visits.
              </p>
            </div>
            <ul className="trades rise">
              {TRADES.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---------- early access ---------- */}
        <section id="early">
          <div className="wrap">
            <div className="section-head rise">
              <p className="eyebrow">Early access</p>
              <h2>Get in before the doors open.</h2>
              <p className="lede">
                We’re opening Yuzuu in waves, trade by trade, so every business gets a proper setup
                instead of a blank screen and a login.
              </p>
            </div>

            <div className="money">
              <div className="split rise">
                <div className="row">
                  <span className="k">Joining the waitlist</span>
                  <span className="v hot">Free</span>
                </div>
                <div className="row">
                  <span className="k">Card needed</span>
                  <span className="v">None</span>
                </div>
                <div className="row">
                  <span className="k">Commitment</span>
                  <span className="v">None</span>
                </div>
                <div className="row">
                  <span className="k">Emails before your spot opens</span>
                  <span className="v">Zero</span>
                </div>
                <p className="later" style={{ color: "rgba(251, 252, 245, 0.62)" }}>
                  Pricing is published before early access opens. Waitlist members see it first.
                </p>
              </div>

              <div className="owns rise">
                <h3>What early members get</h3>
                <ul>
                  <li>First access, ahead of the public launch.</li>
                  <li>Setup done with you: your services, your price rules, your journeys.</li>
                  <li>A direct line to the people building it. Your feedback shapes what ships.</li>
                </ul>
                <a className="btn btn-peel owns-cta" href="#join">
                  Join the waitlist
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- faq ---------- */}
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

        {/* ---------- closer ---------- */}
        <section className="closer" id="join">
          <div className="wrap">
            <p className="eyebrow" style={{ color: "var(--peel)" }}>
              Early access
            </p>
            <h2>
              Get your evenings back. <span>Let Yuzuu handle the rest.</span>
            </h2>
            <p className="lede">
              Join the waitlist. We’ll open access in waves and email you once, when it’s your
              turn.
            </p>
            <WaitlistForm inputId="email-foot" source="closer" peel withTrade />
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
          <span className="foot-built">
            Platform built by{" "}
            <a href="https://www.visionbds.com" target="_blank" rel="noopener">
              service business
            </a>{" "}
            owners, for service business owners
          </span>
          <span className="sp">© 2026 Yuzuu</span>
          <Link href="/privacy">Privacy</Link>
          <a href="mailto:hello@yuzuu.co">hello@yuzuu.co</a>
        </div>
      </footer>
    </div>
  );
}
