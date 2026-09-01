import "server-only";
import { CREATOR_KEEP_PCT } from "./seo";
import type { ShareKit } from "./db/types";

const FROM = process.env.EMAIL_FROM || "Yuzuu <onboarding@resend.dev>";

/** Matches globals.css design tokens. */
const C = {
  paper: "#f4f5f0",
  raised: "#ffffff",
  ink: "#16201b",
  inkSoft: "#3d4b43",
  sage: "#6e7c73",
  line: "#d9ded4",
  zest: "#b9cc3a",
} as const;

const FONT_DISPLAY = "Georgia, 'Times New Roman', serif";
const FONT_UI = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
const FONT_MONO = "ui-monospace, 'SF Mono', Menlo, Consolas, monospace";

function appUrl(path: string) {
  return `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}${path}`;
}

async function send(to: string, subject: string, html: string) {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[email skipped — no RESEND_API_KEY] to=${to} subject="${subject}"`);
    return;
  }
  // Email is best-effort: the product (dashboard, order page) is the source of
  // truth, so an unverified domain or Resend outage must not fail the job.
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({ from: FROM, to, subject, html });
    if (error) throw new Error(error.message);
  } catch (err) {
    console.error(`[email failed] to=${to} subject="${subject}":`, err);
  }
}

/** App wordmark — zest fruit + "yuzuu" (table layout for email clients). */
function wordmark() {
  return `
<table cellpadding="0" cellspacing="0" border="0" role="presentation">
  <tr>
    <td style="padding-right:7px;vertical-align:middle;">
      <table cellpadding="0" cellspacing="0" border="0" role="presentation">
        <tr>
          <td align="center" style="line-height:0;">
            <div style="width:6px;height:4px;background:${C.ink};border-radius:0 60% 0 60%;margin:0 auto -1px;"></div>
          </td>
        </tr>
        <tr>
          <td style="width:15px;height:15px;background:${C.zest};border-radius:50%;font-size:0;line-height:0;">&nbsp;</td>
        </tr>
      </table>
    </td>
    <td style="vertical-align:middle;font-family:${FONT_DISPLAY};font-size:21px;font-weight:600;letter-spacing:-0.03em;color:${C.ink};">yuzuu</td>
  </tr>
</table>`;
}

function paragraph(html: string) {
  return `<p style="margin:0 0 16px;font-family:${FONT_UI};font-size:16px;line-height:1.6;color:${C.inkSoft};">${html}</p>`;
}

function button(href: string, label: string) {
  return `
<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin-top:28px;">
  <tr>
    <td style="background:${C.ink};border-radius:3px;">
      <a href="${href}" style="display:inline-block;padding:11px 26px;font-family:${FONT_UI};font-size:15px;font-weight:500;color:${C.paper};text-decoration:none;">${label}</a>
    </td>
  </tr>
</table>`;
}

function wrap(body: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
</head>
<body style="margin:0;padding:0;background:${C.paper};">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="background:${C.paper};padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="max-width:520px;background:${C.raised};border:1px solid ${C.line};border-radius:8px;">
          <tr>
            <td style="padding:32px 28px;">
              ${wordmark()}
              <div style="height:28px;line-height:28px;font-size:0;">&nbsp;</div>
              ${body}
              <p style="margin:36px 0 0;padding-top:20px;border-top:1px solid ${C.line};font-family:${FONT_MONO};font-size:11px;font-weight:500;letter-spacing:0.13em;text-transform:uppercase;color:${C.sage};">Sent by Yuzuu · Reply if something looks wrong</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendIdeasReady(to: string, handle: string) {
  await send(
    to,
    "Your product ideas are ready",
    wrap(`
      ${paragraph(`We read <strong style="color:${C.ink};font-weight:600;">@${handle}</strong> and found 3 products your audience would buy, plus 1 wild card.`)}
      ${paragraph("Pick the one that feels most like you. The rest happens automatically.")}
      ${button(appUrl("/onboard/ideas"), "See the 3+1 ideas")}
    `)
  );
}

export async function sendSamplesReady(to: string, topicTitle: string) {
  await send(
    to,
    "Three sample plans are ready for you to read",
    wrap(`
      ${paragraph(`<strong style="color:${C.ink};font-weight:600;">${topicTitle}</strong> is built. Before it goes live, read three sample plans. We invented three very different buyers and wrote each of them their own plan, exactly how every real buyer's will be written.`)}
      ${paragraph("Nothing is published until you approve.")}
      ${button(appUrl("/onboard/review"), "Read the samples")}
    `)
  );
}

export async function sendBuildDeclined(to: string, handle: string, reason: string) {
  await send(
    to,
    "We couldn't build a product for your account yet",
    wrap(`
      ${paragraph(`We read <strong style="color:${C.ink};font-weight:600;">@${handle}</strong> but couldn't find a product we'd be confident selling under your name. ${reason}`)}
      ${paragraph("Shipping something mediocre with your name on it is worse than waiting. You can try again any time.")}
      ${button(appUrl("/onboard"), "Try again")}
    `)
  );
}

/** Copyable block of paste-ready text (bio line, caption, …). */
function pasteBlock(label: string, text: string) {
  return `
<div style="margin:0 0 14px;">
  <p style="margin:0 0 6px;font-family:${FONT_MONO};font-size:11px;font-weight:500;letter-spacing:0.13em;text-transform:uppercase;color:${C.sage};">${label}</p>
  <div style="padding:12px 14px;background:${C.paper};border:1px solid ${C.line};border-radius:6px;font-family:${FONT_UI};font-size:14px;line-height:1.55;color:${C.inkSoft};white-space:pre-wrap;">${text}</div>
</div>`;
}

function netUsd(priceCents: number): string {
  return (Math.round((priceCents * CREATOR_KEEP_PCT) / 100) / 100).toFixed(2);
}

// ─────────────────────────────────────────────── creator lifecycle emails

export async function sendYoureLive(
  to: string,
  args: { handle: string; topicTitle: string; priceCents: number; kit: ShareKit | null }
) {
  const url = `yuzuu.co/u/${args.handle}`;
  await send(
    to,
    "Your product is live — one post from your first sale",
    wrap(`
      ${paragraph(`<strong style="color:${C.ink};font-weight:600;">${args.topicTitle}</strong> is live at <strong style="color:${C.ink};font-weight:600;">${url}</strong>.`)}
      ${paragraph(`Every $${(args.priceCents / 100).toFixed(0)} sale puts <strong style="color:${C.ink};font-weight:600;">$${netUsd(args.priceCents)}</strong> in your pocket. The only step left is telling your audience — here's the copy, ready to paste:`)}
      ${args.kit ? pasteBlock("Your bio line", args.kit.bio_line) : ""}
      ${args.kit ? pasteBlock("A caption for your next post", args.kit.caption) : ""}
      ${button(appUrl("/dashboard"), "Open your launch kit")}
    `)
  );
}

export async function sendSaleNotification(
  to: string,
  args: { topicTitle: string; priceCents: number; saleNumber: number }
) {
  const net = netUsd(args.priceCents);
  const first = args.saleNumber === 1;
  await send(
    to,
    first ? `Your first sale — you just earned $${net}` : `New sale — $${net} (#${args.saleNumber})`,
    wrap(`
      ${
        first
          ? paragraph(`Someone just paid for <strong style="color:${C.ink};font-weight:600;">${args.topicTitle}</strong>. That's <strong style="color:${C.ink};font-weight:600;">$${net}</strong> — your first sale. It works.`) +
            paragraph("One person paying means others will. The move now: post again while it's true — \u201Csomeone just bought this\u201D is the most honest promotion you'll ever run.")
          : paragraph(`Sale #${args.saleNumber} of <strong style="color:${C.ink};font-weight:600;">${args.topicTitle}</strong> — another <strong style="color:${C.ink};font-weight:600;">$${net}</strong> for you.`)
      }
      ${button(appUrl("/dashboard"), "See your sales")}
    `)
  );
}

export async function sendMilestone(
  to: string,
  args: { kind: "5_sales" | "10_sales" | "100_usd"; topicTitle: string }
) {
  const subjects = {
    "5_sales": "5 plans sold",
    "10_sales": "10 plans sold",
    "100_usd": "You've earned your first $100",
  } as const;
  const bodies = {
    "5_sales": "Five different people paid for your product. This is repeatable — keep the link visible and keep posting.",
    "10_sales": "Ten buyers. At this point it's not luck. A story every few days keeps it moving.",
    "100_usd": "Your product has now earned you over $100. This is what a product that sells itself looks like — your job is only to keep it in front of people.",
  } as const;
  await send(
    to,
    `${subjects[args.kind]} — ${args.topicTitle}`,
    wrap(`
      ${paragraph(bodies[args.kind])}
      ${button(appUrl("/dashboard"), "See your numbers")}
    `)
  );
}

export async function sendIdeaReminder(to: string, args: { daysLeft: number }) {
  await send(
    to,
    "Your product ideas are waiting — pick one",
    wrap(`
      ${paragraph("We built product ideas from your audience and they're sitting unpicked. Choosing one takes a minute; the rest happens automatically.")}
      ${paragraph(`<span style="font-size:14px;color:${C.sage};">They expire in ${args.daysLeft} day${args.daysLeft === 1 ? "" : "s"} — after that the build closes and you'd have to start over.</span>`)}
      ${button(appUrl("/onboard/ideas"), "Pick your product")}
    `)
  );
}

export async function sendReviewReminder(
  to: string,
  args: { topicTitle: string; daysLeft: number }
) {
  await send(
    to,
    "Your product is built — it just needs your yes",
    wrap(`
      ${paragraph(`<strong style="color:${C.ink};font-weight:600;">${args.topicTitle}</strong> is finished, with three sample plans waiting for you to read. Nothing goes live until you approve.`)}
      ${paragraph(`<span style="font-size:14px;color:${C.sage};">The review closes in ${args.daysLeft} day${args.daysLeft === 1 ? "" : "s"}.</span>`)}
      ${button(appUrl("/onboard/review"), "Read the samples")}
    `)
  );
}

export type LaunchNudgeVariant = "1h" | "24h" | "3d" | "7d";

export async function sendLaunchNudge(
  to: string,
  args: {
    variant: LaunchNudgeVariant;
    handle: string;
    topicTitle: string;
    kit: ShareKit | null;
    visits: number;
    quizStarts: number;
  }
) {
  const url = `yuzuu.co/u/${args.handle}`;
  const variants: Record<LaunchNudgeVariant, { subject: string; body: string; asset: "caption" | "story_text" | "reel_script" }> = {
    "1h": {
      subject: "Post today — your product only sells if people see it",
      body: `<strong style="color:${C.ink};font-weight:600;">${args.topicTitle}</strong> is live but nobody has visited ${url} yet. That's normal — nobody knows it exists. One post fixes it, and the caption is already written:`,
      asset: "caption",
    },
    "24h": {
      subject: "Nobody has taken your quiz yet — try a story",
      body: `Your page ${args.visits ? `has had ${args.visits} visit${args.visits === 1 ? "" : "s"}` : "is live"} but nobody has started the quiz. A story with a link sticker is the fastest way in — here's the text:`,
      asset: "story_text",
    },
    "3d": {
      subject: `${args.quizStarts ? `${args.quizStarts} people started your quiz` : "Three days live"} — no sale yet. Different angle?`,
      body: args.quizStarts
        ? `${args.quizStarts} ${args.quizStarts === 1 ? "person" : "people"} started your quiz — real interest. No sale yet usually just means not enough people have seen it. A short reel reaches further than a story:`
        : `Three days live and quiet. Feeds move fast — one post rarely lands. A short reel reaches people a story doesn't:`,
      asset: "reel_script",
    },
    "7d": {
      subject: "A week live — let's get your first sale",
      body: `A week in without a sale means the product hasn't been in front of enough people yet — not that it's wrong. What works: the link permanently in your bio, and a mention every few posts. If you think the product itself is off, reply to this email and tell us what's wrong — we can rebuild it.`,
      asset: "caption",
    },
  };
  const v = variants[args.variant];
  const assetLabel =
    v.asset === "caption" ? "Caption" : v.asset === "story_text" ? "Story text" : "Reel script";
  await send(
    to,
    v.subject,
    wrap(`
      ${paragraph(v.body)}
      ${args.kit ? pasteBlock(assetLabel, args.kit[v.asset]) : ""}
      ${button(appUrl("/dashboard"), "Open your launch kit")}
    `)
  );
}

export async function sendFirstVisitor(to: string, args: { handle: string }) {
  await send(
    to,
    "You just got your first visitor! 🙌",
    wrap(`
      ${paragraph(`Your first visitor just landed on <strong style="color:${C.ink};font-weight:600;">yuzuu.co/u/${args.handle}</strong>. Whatever you posted — it's working. Keep the link visible.`)}
      ${button(appUrl("/dashboard"), "Watch it live")}
    `)
  );
}

export async function sendFirstQuizStart(to: string, args: { handle: string }) {
  await send(
    to,
    "Someone is taking your quiz right now",
    wrap(`
      ${paragraph(`A visitor on <strong style="color:${C.ink};font-weight:600;">yuzuu.co/u/${args.handle}</strong> just started answering your quiz. People who finish it are one click from buying — you're close.`)}
      ${button(appUrl("/dashboard"), "See your funnel")}
    `)
  );
}

// ───────────────────────────────────────────────────── buyer recovery

export async function sendAbandonedCheckout(
  to: string,
  args: {
    creatorName: string;
    topicTitle: string;
    handle: string;
    sessionId: string;
    priceCents: number;
  }
) {
  await send(
    to,
    `Your answers are saved — your plan from ${args.creatorName} is ready to be written`,
    wrap(`
      ${paragraph(`You answered ${args.creatorName}'s quiz for <strong style="color:${C.ink};font-weight:600;">${args.topicTitle}</strong> but didn't finish. Your answers are saved — picking up takes one click, and the plan is written for your exact situation.`)}
      ${button(appUrl(`/u/${args.handle}/checkout?session=${args.sessionId}`), "Finish and get my plan")}
      ${paragraph(`<span style="font-size:14px;color:${C.sage};">$${(args.priceCents / 100).toFixed(0)} one time. If it doesn't fit your situation, there's a 14-day full refund.</span>`)}
    `)
  );
}

export async function sendPlanDelivered(
  to: string,
  args: { topicTitle: string; creatorName: string; orderId: string }
) {
  await send(
    to,
    `Your plan is ready: ${args.topicTitle}`,
    wrap(`
      ${paragraph(`Your personalized plan from <strong style="color:${C.ink};font-weight:600;">${args.creatorName}</strong> is ready. Written for you alone, from your answers.`)}
      ${button(appUrl(`/order/${args.orderId}`), "Read your plan")}
      ${paragraph(`<span style="font-size:14px;color:${C.sage};">This private link is yours to keep, and you can save the page as a PDF any time.</span>`)}
    `)
  );
}

/** Generation failed for good — the buyer is refunded automatically and told
 * plainly. Runs from planGenerate's onFailure handler. */
export async function sendOrderRefunded(
  to: string,
  args: { topicTitle: string; grossCents: number }
) {
  await send(
    to,
    "We couldn't write your plan — you've been refunded in full",
    wrap(`
      ${paragraph(`Something went wrong on our side while writing <strong style="color:${C.ink};font-weight:600;">${args.topicTitle}</strong>, and we couldn't deliver what you paid for.`)}
      ${paragraph(`We've refunded the full <strong style="color:${C.ink};font-weight:600;">$${(args.grossCents / 100).toFixed(2)}</strong> to your card — it usually lands within a few business days. No action needed.`)}
      ${paragraph(`<span style="font-size:14px;color:${C.sage};">We're sorry for the letdown. If you'd like to try again later, your quiz takes two minutes.</span>`)}
    `)
  );
}

// ─────────────────────────────────────────────────────────── payouts

/** The monthly payout landed. Sent when the admin marks a payout paid. */
export async function sendPayoutPaid(
  to: string,
  args: { amountCents: number; periodEnd: string | null }
) {
  const period = args.periodEnd
    ? new Date(args.periodEnd).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : "this month";
  await send(
    to,
    `Your payout is on its way: $${(args.amountCents / 100).toFixed(2)}`,
    wrap(`
      ${paragraph(`We've just sent your <strong style="color:${C.ink};font-weight:600;">$${(args.amountCents / 100).toFixed(2)}</strong> payout for ${period}. Depending on your bank it can take a few business days to show up.`)}
      ${paragraph(`That's your ${CREATOR_KEEP_PCT}% of every sale, minus refunds. The full breakdown is in your dashboard.`)}
      ${button(appUrl("/dashboard"), "See your earnings")}
    `)
  );
}
