import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { Wordmark } from "@/components/Wordmark";
import { OrderPoller } from "@/components/OrderPoller";
import { PlanDocument } from "@/components/plan/PlanDocument";
import { PrintButton } from "@/components/plan/PrintButton";
import type { Blueprint } from "@/lib/blueprint/types";
import type { OrderRow, OutputRow, BlueprintRow } from "@/lib/db/types";
import "../../plan.css";

export const dynamic = "force-dynamic";

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = supabaseAdmin();

  const { data: orderRow } = await admin.from("orders").select("*").eq("id", id).maybeSingle();
  if (!orderRow) notFound();
  const order = orderRow as OrderRow;

  const { data: bpRow } = await admin
    .from("blueprints")
    .select("data, creator_id")
    .eq("id", order.blueprint_id)
    .single();
  const bp = (bpRow as Pick<BlueprintRow, "data" | "creator_id">).data as Blueprint;
  // Show the Instagram handle, not the OAuth display name — it's what the
  // buyer actually recognizes and it's what the product page is built on.
  const creatorName = `@${bp.creator.handle}`;

  const { data: creatorRow } = await admin
    .from("creators")
    .select("avatar_url")
    .eq("id", (bpRow as Pick<BlueprintRow, "data" | "creator_id">).creator_id)
    .maybeSingle();
  const creatorAvatarUrl = (creatorRow as { avatar_url: string | null } | null)?.avatar_url ?? null;

  // ── generating / failed ────────────────────────────────────────────────
  if (order.status !== "delivered") {
    const failed = order.status === "failed";
    return (
      <section>
        <header className="bar">
          <div className="bar-in">
            <div className="avatar">
              {creatorAvatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- external OAuth avatar, not worth next/image remote-pattern config
                <img
                  className="avatar-img"
                  src={creatorAvatarUrl}
                  alt={creatorName}
                  referrerPolicy="no-referrer"
                />
              ) : (
                bp.creator.handle[0]?.toUpperCase()
              )}
            </div>
            <div className="who">
              <b>{bp.product.topic_title}</b>
              <span>Order {id.slice(0, 8)}</span>
            </div>
          </div>
        </header>
        <div className="gen">
          <div className="micro">{failed ? "Something went wrong" : "Being written now"}</div>
          <h1 style={{ marginTop: 16 }}>
            {failed ? "We hit a problem generating your plan." : "Your plan is being written."}
          </h1>
          {failed ? (
            <p className="lede">
              Your payment is safe. We&apos;ve been notified and will email your plan to{" "}
              {order.buyer_email} as soon as it&apos;s fixed.
            </p>
          ) : (
            <>
              <p className="lede">
                This usually takes about a minute. You can close this page. We&apos;ll email it to{" "}
                {order.buyer_email} too.
              </p>
              <OrderPoller orderId={id} />
            </>
          )}
        </div>
        <footer className="powered-by pd-noprint">
          <span>Powered by</span>
          <Wordmark size={15} />
        </footer>
      </section>
    );
  }

  // ── delivered: the personalized document ──────────────────────────────
  const { data: outputRow } = await admin
    .from("outputs")
    .select("*")
    .eq("order_id", id)
    .maybeSingle();
  const output = outputRow as OutputRow | null;
  if (!output) notFound();

  const template = bp.output.template;

  return (
    <section>
      <header className="bar">
        <div className="bar-in wide">
          <div className="avatar">
            {creatorAvatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- external OAuth avatar, not worth next/image remote-pattern config
              <img
                className="avatar-img"
                src={creatorAvatarUrl}
                alt={creatorName}
                referrerPolicy="no-referrer"
              />
            ) : (
              bp.creator.handle[0]?.toUpperCase()
            )}
          </div>
          <div className="who">
            <b>{bp.product.topic_title}</b>
            <span>by {creatorName} · your copy</span>
          </div>
          <div className="right">
            <PrintButton />
          </div>
        </div>
      </header>

      <div className="out">
        <nav className="toc pd-noprint">
          <span className="micro">Contents</span>
          {template.sections
            .filter((s) => output.sections.sections?.[s.id])
            .map((s) => (
              <a key={s.id} href={`#${s.id}`}>
                {s.title}
              </a>
            ))}
        </nav>

        <div>
          <PlanDocument
            template={template}
            output={output.sections}
            creatorName={creatorName}
            disclaimers={bp.safety.disclaimers}
          />
          <div className="dl pd-noprint" style={{ maxWidth: 880, margin: "0 auto", padding: "0 24px" }}>
            <span style={{ fontSize: 13.5, color: "var(--sage)" }}>
              Also sent to {order.buyer_email}. This link keeps working. Use Save as PDF for an
              offline copy.
            </span>
          </div>
        </div>
      </div>

      <footer className="powered-by pd-noprint">
        <span>Powered by</span>
        <Wordmark size={15} />
      </footer>
    </section>
  );
}
