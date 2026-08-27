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
  const creatorName = bp.creator.display_name ?? `@${bp.creator.handle}`;

  // ── generating / failed ────────────────────────────────────────────────
  if (order.status !== "delivered") {
    const failed = order.status === "failed";
    return (
      <section>
        <header className="bar">
          <div className="bar-in">
            <div className="who">
              <b>{bp.product.topic_title}</b>
              <span>Order {id.slice(0, 8)}</span>
            </div>
            <div className="right">
              <Wordmark />
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
                This usually takes about a minute. You can close this page — we&apos;ll email it to{" "}
                {order.buyer_email} too.
              </p>
              <OrderPoller orderId={id} />
            </>
          )}
        </div>
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
          <div className="who">
            <b>{bp.product.topic_title}</b>
            <span>by {creatorName} · your copy</span>
          </div>
          <div className="right">
            <PrintButton />
            <Wordmark />
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
              Also sent to {order.buyer_email}. This link keeps working — use Save as PDF for an
              offline copy.
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
