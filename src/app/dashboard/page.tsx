import Link from "next/link";
import { redirect } from "next/navigation";
import { requireCreator } from "@/lib/auth";
import { latestBuild, routeForBuild } from "@/lib/builds";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { AppBar } from "@/components/AppBar";
import { LaunchKit } from "@/components/LaunchKit";
import { fallbackShareKit } from "@/lib/share-kit";
import { creatorBalance, MIN_PAYOUT_CENTS, AVAILABLE_AFTER_DAYS } from "@/lib/ledger";
import { setPayoutDetails } from "./actions";
import { CREATOR_KEEP_PCT } from "@/lib/seo";
import type { Blueprint } from "@/lib/blueprint/types";
import type { BlueprintRow, OrderRow, QuizSessionRow } from "@/lib/db/types";

function usd(cents: number): string {
  const v = cents / 100;
  return `$${v.toFixed(v > 0 && v < 100 ? 2 : 0)}`;
}

function countLastWeek(orders: OrderRow[]): number {
  const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
  return orders.filter((o) => new Date(o.created_at).getTime() > weekAgo).length;
}

/** j•••@example.com — leads gave their email for a plan, not for display. */
function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!domain) return "•••";
  return `${user.slice(0, 1)}•••@${domain}`;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ published?: string }>;
}) {
  const { published } = await searchParams;
  const creator = await requireCreator();
  const admin = supabaseAdmin();

  const { data: bpRow } = await admin
    .from("blueprints")
    .select("*")
    .eq("creator_id", creator.id)
    .eq("published", true)
    .maybeSingle();

  // no live product: send them wherever their build is (or to onboarding)
  if (!bpRow) {
    const build = await latestBuild(creator.id);
    const route = routeForBuild(build);
    if (route !== "/dashboard") redirect(route);
    redirect("/onboard");
  }

  const blueprint = bpRow as BlueprintRow;
  const bp = blueprint.data as Blueprint;

  const [{ data: orderRows }, { count: visitCount }, { data: sessionRows }, balance] =
    await Promise.all([
      admin
        .from("orders")
        .select("*")
        .eq("blueprint_id", blueprint.id)
        .in("status", ["paid", "generating", "delivered"])
        .order("created_at", { ascending: false }),
      admin
        .from("creator_events")
        .select("id", { count: "exact", head: true })
        .eq("creator_id", creator.id)
        .eq("type", "page_visit"),
      admin
        .from("quiz_sessions")
        .select("id, status, email, updated_at, order_id")
        .eq("creator_id", creator.id)
        .order("updated_at", { ascending: false }),
      creatorBalance(creator.id),
    ]);

  const orders = (orderRows ?? []) as OrderRow[];
  const sessions = (sessionRows ?? []) as Pick<
    QuizSessionRow,
    "id" | "status" | "email" | "updated_at" | "order_id"
  >[];

  const sold = orders.length;
  const balanceCents = balance.availableCents + balance.pendingCents;
  const thisWeek = countLastWeek(orders);
  const activated = Boolean(creator.first_sale_at) || sold > 0;

  const visits = visitCount ?? 0;
  const quizStarts = sessions.length;
  const quizFinished = sessions.filter((s) => s.status !== "quiz_started").length;
  const leads = sessions.filter((s) => s.email && s.status !== "paid" && !s.order_id);

  const price = (blueprint.price_cents / 100).toFixed(0);
  const netPerSale = ((blueprint.price_cents * CREATOR_KEEP_PCT) / 100 / 100).toFixed(2);
  const url = `yuzuu.co/u/${creator.handle}`;
  const initial = creator.display_name?.[0] ?? creator.email[0];

  const kit =
    blueprint.share_kit ??
    fallbackShareKit({
      handle: creator.handle ?? "",
      topicTitle: bp.product.topic_title,
      promise: bp.product.promise,
      priceCents: blueprint.price_cents,
      durationDays: bp.product.duration_days,
    });

  return (
    <section>
      <AppBar initial={initial} avatarUrl={creator.avatar_url} wide />
      <div className="wrap wide">
        {published ? (
          <div className="notice" style={{ marginBottom: 26 }}>
            <b>Your product is live.</b> It can sell while you sleep — but only once people see
            it. The checklist below is the whole job.
          </div>
        ) : null}

        <div className="micro">Your product</div>
        <h1 style={{ marginTop: 14 }}>{bp.product.topic_title}</h1>

        <div className="live" style={{ marginTop: 26 }}>
          <span className="badge">Live</span>
          <span className="url">{url}</span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
            <Link className="btn btn-outline btn-sm" href={`/u/${creator.handle}`}>
              View page
            </Link>
            {activated ? (
              <Link className="btn btn-ghost btn-sm" href="/onboard?new=1">
                Build a new product
              </Link>
            ) : null}
          </div>
        </div>

        {!activated ? (
          <div style={{ marginTop: 26 }}>
            <LaunchKit
              handle={creator.handle ?? ""}
              url={url}
              kit={kit}
              checklist={creator.launch_checklist ?? {}}
              netPerSale={netPerSale}
              price={price}
            />
          </div>
        ) : null}

        <div className="stats four">
          <div className="stat">
            <span className="k">Page visits</span>
            <div className="v">{visits}</div>
            <div className="sub">people who opened your page</div>
          </div>
          <div className="stat">
            <span className="k">Quiz starts</span>
            <div className="v">{quizStarts}</div>
            <div className="sub">{quizFinished} finished it</div>
          </div>
          <div className="stat">
            <span className="k">Plans sold</span>
            <div className="v">{sold}</div>
            <div className="sub">
              {sold > 0
                ? `${thisWeek} in the last 7 days`
                : quizStarts > 0
                  ? "buyers are close — keep posting"
                  : "starts with one post"}
            </div>
          </div>
          <div className="stat">
            <span className="k">Your balance</span>
            <div className="v">{usd(balanceCents)}</div>
            <div className="sub">
              {balanceCents > 0
                ? `${usd(balance.availableCents)} payable now · ${usd(balance.pendingCents)} clearing`
                : `your ${CREATOR_KEEP_PCT}% — $${netPerSale} per $${price} sale`}
            </div>
          </div>
        </div>

        <div className="card" style={{ marginTop: 26 }}>
          <span className="micro">Getting paid</span>
          <p style={{ marginTop: 12, fontSize: 14.5, color: "var(--ink-soft)", maxWidth: "62ch" }}>
            Payouts go out monthly on the 1st, once your balance passes{" "}
            <b>${(MIN_PAYOUT_CENTS / 100).toFixed(0)}</b> — below that it simply rolls into the
            next month. A sale becomes payable {AVAILABLE_AFTER_DAYS} days after purchase, when
            its refund window closes.
            {balance.paidOutCents > 0 ? <> Paid out so far: <b>{usd(balance.paidOutCents)}</b>.</> : null}
          </p>
          {creator.payout_status === "ready" ? (
            <p style={{ marginTop: 10, fontSize: 14.5, color: "var(--ink-soft)" }}>
              Payout details confirmed: <b>{creator.payout_provider}</b> ·{" "}
              {creator.payout_recipient_id}
            </p>
          ) : creator.payout_status === "pending" ? (
            <p style={{ marginTop: 10, fontSize: 14.5, color: "var(--sage)" }}>
              Details received ({creator.payout_provider} · {creator.payout_recipient_id}) —
              we&apos;ll confirm them before your first payout.
            </p>
          ) : null}
          <form className="payout-form" action={setPayoutDetails}>
            <select
              name="payout_provider"
              defaultValue={creator.payout_provider ?? "paypal"}
              aria-label="Payout method"
            >
              <option value="paypal">PayPal</option>
              <option value="bank">Bank transfer</option>
              <option value="other">Other</option>
            </select>
            <input
              type="text"
              name="payout_recipient"
              placeholder="PayPal email, or how to reach you about payment"
              defaultValue={creator.payout_recipient_id ?? ""}
              required
            />
            <button className="btn btn-outline btn-sm" type="submit">
              {creator.payout_status === "not_set" ? "Save payout details" : "Update"}
            </button>
          </form>
          <p className="hint" style={{ marginTop: 10 }}>
            An email or a short note is enough — never paste full bank account numbers here.
          </p>
        </div>

        {leads.length > 0 ? (
          <div className="card" style={{ marginTop: 26 }}>
            <span className="micro">Almost-buyers</span>
            <p style={{ marginTop: 12, fontSize: 14.5, color: "var(--ink-soft)" }}>
              {leads.length} {leads.length === 1 ? "person" : "people"} finished your quiz and left
              an email without buying. We follow up with them automatically.
            </p>
            <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>
              {leads.slice(0, 12).map((l) => (
                <span key={l.id} className="chip">
                  {maskEmail(l.email!)}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <div className="card" style={{ marginTop: 26 }}>
          <span className="micro">Recent buyers</span>
          {orders.length === 0 ? (
            <p style={{ marginTop: 16, fontSize: 14.5, color: "var(--sage)" }}>
              {quizStarts > 0
                ? `No buyers yet — but ${quizStarts} ${quizStarts === 1 ? "person has" : "people have"} started your quiz. Every sale shows up here the second it happens.`
                : `No buyers yet. Nobody buys what they haven't seen — the launch checklist above puts ${url} in front of your audience.`}
            </p>
          ) : (
            <table className="tbl" style={{ marginTop: 14 }}>
              <thead>
                <tr>
                  <th>Buyer</th>
                  <th>Status</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {orders.slice(0, 12).map((o) => (
                  <tr key={o.id}>
                    <td>{o.buyer_email}</td>
                    <td className="mono">{o.status}</td>
                    <td className="mono">{new Date(o.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  );
}
