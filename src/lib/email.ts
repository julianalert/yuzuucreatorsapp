import "server-only";

const FROM = process.env.EMAIL_FROM || "Yuzuu <onboarding@resend.dev>";

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

const wrap = (body: string) => `
<div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#16201B">
  <div style="font-size:22px;margin-bottom:28px">yuzuu<span style="color:#B9CC3A">.</span></div>
  ${body}
  <p style="margin-top:36px;font-size:12px;color:#6E7C73">Sent by Yuzuu. Reply to this email if something looks wrong.</p>
</div>`;

export async function sendIdeasReady(to: string, handle: string) {
  await send(
    to,
    "Your product ideas are ready",
    wrap(`
      <p style="font-size:16px;line-height:1.6">We read <b>@${handle}</b> and found five products your audience would buy.</p>
      <p style="font-size:16px;line-height:1.6">Pick the one that feels most like you — the rest happens automatically.</p>
      <p style="margin-top:28px"><a href="${appUrl("/onboard/ideas")}" style="background:#16201B;color:#F4F5F0;padding:12px 24px;text-decoration:none;border-radius:3px;font-family:sans-serif;font-size:15px">See the five ideas</a></p>
    `)
  );
}

export async function sendSamplesReady(to: string, topicTitle: string) {
  await send(
    to,
    "Three sample plans are ready for you to read",
    wrap(`
      <p style="font-size:16px;line-height:1.6"><b>${topicTitle}</b> is built. Before it goes live, read three sample plans — each one is what a different kind of buyer would receive.</p>
      <p style="font-size:16px;line-height:1.6">Nothing is published until you approve.</p>
      <p style="margin-top:28px"><a href="${appUrl("/onboard/review")}" style="background:#16201B;color:#F4F5F0;padding:12px 24px;text-decoration:none;border-radius:3px;font-family:sans-serif;font-size:15px">Read the samples</a></p>
    `)
  );
}

export async function sendBuildDeclined(to: string, handle: string, reason: string) {
  await send(
    to,
    "We couldn't build a product for your account yet",
    wrap(`
      <p style="font-size:16px;line-height:1.6">We read <b>@${handle}</b> but couldn't find a product we'd be confident selling under your name. ${reason}</p>
      <p style="font-size:16px;line-height:1.6">Shipping something mediocre with your name on it is worse than waiting — you can try again any time.</p>
      <p style="margin-top:28px"><a href="${appUrl("/onboard")}" style="background:#16201B;color:#F4F5F0;padding:12px 24px;text-decoration:none;border-radius:3px;font-family:sans-serif;font-size:15px">Try again</a></p>
    `)
  );
}

export async function sendPlanDelivered(
  to: string,
  args: { topicTitle: string; creatorName: string; orderId: string }
) {
  await send(
    to,
    `Your plan is ready — ${args.topicTitle}`,
    wrap(`
      <p style="font-size:16px;line-height:1.6">Your personalized plan from <b>${args.creatorName}</b> is ready.</p>
      <p style="margin-top:28px"><a href="${appUrl(`/order/${args.orderId}`)}" style="background:#16201B;color:#F4F5F0;padding:12px 24px;text-decoration:none;border-radius:3px;font-family:sans-serif;font-size:15px">Read your plan</a></p>
      <p style="font-size:14px;line-height:1.6;color:#3D4B43">The link includes a PDF download. It's yours to keep.</p>
    `)
  );
}
