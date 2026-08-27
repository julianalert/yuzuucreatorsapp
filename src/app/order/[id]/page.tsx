import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { Wordmark } from "@/components/Wordmark";
import { OrderPoller } from "@/components/OrderPoller";
import type { Blueprint } from "@/lib/blueprint/types";
import type { OrderRow, OutputRow, BlueprintRow } from "@/lib/db/types";

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

  // ── delivered: the web plan ────────────────────────────────────────────
  const { data: outputRow } = await admin
    .from("outputs")
    .select("*")
    .eq("order_id", id)
    .maybeSingle();
  const output = outputRow as OutputRow | null;
  if (!output) notFound();

  const skeleton = bp.output.skeleton;
  const orderedSections = skeleton
    .filter((s) => output.sections[s.id])
    .map((s) => ({ id: s.id, title: s.title, prose: output.sections[s.id] }));

  const archetypeLabel =
    bp.quiz.archetype_rules.find((r) => r.id === order.resolved_archetype)?.label ??
    "Your starting point";

  let pdfUrl: string | null = null;
  if (output.pdf_path) {
    const { data: signed } = await admin.storage
      .from("pdfs")
      .createSignedUrl(output.pdf_path, 60 * 60 * 24 * 7);
    pdfUrl = signed?.signedUrl ?? null;
  }

  return (
    <section>
      <header className="bar">
        <div className="bar-in wide">
          <div className="who">
            <b>{bp.product.topic_title}</b>
            <span>
              by {bp.creator.display_name ?? `@${bp.creator.handle}`} · your copy
            </span>
          </div>
          <div className="right">
            {pdfUrl ? (
              <a className="btn btn-outline btn-sm" href={pdfUrl}>
                Download PDF
              </a>
            ) : null}
            <Wordmark />
          </div>
        </div>
      </header>

      <div className="out">
        <nav className="toc">
          <span className="micro">Contents</span>
          {orderedSections.map((s) => (
            <a key={s.id} href={`#${s.id}`}>
              {s.title}
            </a>
          ))}
        </nav>

        <article className="doc">
          <div className="micro">
            Personalized ·{bp.product.duration_days ? ` ${bp.product.duration_days} days ·` : ""}{" "}
            delivered to {order.buyer_email}
          </div>
          <div className="verdict">
            <span className="micro">Your starting point</span>
            <b>{archetypeLabel}</b>
            <p>
              Everything below is written for this situation — the pacing, the order, and what we
              skip.
            </p>
          </div>

          {orderedSections.map((s) => (
            <div key={s.id} id={s.id}>
              <h2>{s.title}</h2>
              {s.prose
                .split(/\n{2,}/)
                .map((p) => p.trim())
                .filter(Boolean)
                .map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
            </div>
          ))}

          <div className="dl">
            {pdfUrl ? (
              <a className="btn btn-primary" href={pdfUrl}>
                Download the PDF
              </a>
            ) : null}
            <span style={{ fontSize: 13.5, color: "var(--sage)" }}>
              Also sent to {order.buyer_email}. This link keeps working.
            </span>
          </div>
        </article>
      </div>
    </section>
  );
}
