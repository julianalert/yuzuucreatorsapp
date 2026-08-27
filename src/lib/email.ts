import "server-only";

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
      ${paragraph(`<strong style="color:${C.ink};font-weight:600;">${topicTitle}</strong> is built. Before it goes live, read three sample plans. We invented three very different buyers and wrote each of them their own plan — exactly how every real buyer's will be written.`)}
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

export async function sendPlanDelivered(
  to: string,
  args: { topicTitle: string; creatorName: string; orderId: string }
) {
  await send(
    to,
    `Your plan is ready: ${args.topicTitle}`,
    wrap(`
      ${paragraph(`Your personalized plan from <strong style="color:${C.ink};font-weight:600;">${args.creatorName}</strong> is ready — written for you alone, from your answers.`)}
      ${button(appUrl(`/order/${args.orderId}`), "Read your plan")}
      ${paragraph(`<span style="font-size:14px;color:${C.sage};">This private link is yours to keep, and you can save the page as a PDF any time.</span>`)}
    `)
  );
}
