"use server";

export type WaitlistState =
  | { status: "idle" }
  | { status: "ok"; email: string }
  | { status: "error"; message: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const NOTIFY_TO = process.env.WAITLIST_NOTIFY_EMAIL || "hello@yuzuu.co";
const FROM = process.env.EMAIL_FROM || "Yuzuu <hello@yuzuu.co>";
const IS_PROD = process.env.NODE_ENV === "production";

type Signup = { email: string; trade: string | null; source: string | null };

/** Adds an email to the pre-launch waitlist. A signup is kept if either the
 * database insert or the owner notification lands, so a missing table or an
 * email outage alone never loses one. */
export async function joinWaitlist(
  _prev: WaitlistState,
  formData: FormData
): Promise<WaitlistState> {
  // Honeypot: real visitors never see this field, so anything in it is a bot.
  // Answer as if it worked so the bot has nothing to learn from.
  if (String(formData.get("website") ?? "")) return { status: "ok", email: "" };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (email.length > 254 || !EMAIL_RE.test(email)) {
    return { status: "error", message: "That email doesn’t look right. Check it and try again." };
  }
  const signup: Signup = {
    email,
    trade: String(formData.get("trade") ?? "").trim().slice(0, 80) || null,
    source: String(formData.get("source") ?? "").trim().slice(0, 40) || null,
  };

  const saved = await save(signup);
  const notified = await notifyOwner(signup);
  if (!saved && !notified && IS_PROD) {
    return {
      status: "error",
      message: "Something went wrong on our side. Try again, or email hello@yuzuu.co.",
    };
  }
  if (!IS_PROD) console.log("[waitlist]", { ...signup, saved });
  if (saved) await confirm(signup.email);
  return { status: "ok", email };
}

/** Inserts into public.waitlist (supabase/migrations/0013_waitlist.sql)
 * through PostgREST with the service role. Duplicates are ignored, so signing
 * up twice is harmless. */
async function save(signup: Signup): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return false;
  try {
    const res = await fetch(`${url}/rest/v1/waitlist?on_conflict=email`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "resolution=ignore-duplicates,return=minimal",
      },
      body: JSON.stringify(signup),
      cache: "no-store",
    });
    if (!res.ok) console.error("[waitlist] insert failed:", res.status, await res.text());
    return res.ok;
  } catch (err) {
    console.error("[waitlist] insert failed:", err);
    return false;
  }
}

/** Email goes out from production only, so local testing never mails anyone. */
async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!IS_PROD || !key) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to, subject, html }),
      cache: "no-store",
    });
    if (!res.ok) console.error("[waitlist] email failed:", res.status, await res.text());
    return res.ok;
  } catch (err) {
    console.error("[waitlist] email failed:", err);
    return false;
  }
}

function notifyOwner({ email, trade, source }: Signup) {
  return sendEmail(
    NOTIFY_TO,
    `Waitlist: ${email}${trade ? ` (${trade})` : ""}`,
    `<p><b>${escapeHtml(email)}</b> joined the Yuzuu waitlist.</p>
     <p>Trade: ${escapeHtml(trade ?? "—")}<br>Form: ${escapeHtml(source ?? "—")}</p>`
  );
}

function confirm(email: string) {
  return sendEmail(
    email,
    "You’re on the Yuzuu waitlist",
    `<div style="font-family:Georgia,serif;font-size:16px;line-height:1.6;color:#0c1a13;max-width:520px">
      <p>Thanks for joining the Yuzuu waitlist.</p>
      <p>We’re opening early access in waves, trade by trade. When your spot opens, you’ll get one email from us with everything you need to get started.</p>
      <p>Until then, nothing else lands in your inbox. If you’d like to tell us how your business runs today, just reply. We read everything.</p>
      <p>The Yuzuu team</p>
    </div>`
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
