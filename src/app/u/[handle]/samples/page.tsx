import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { productForViewer } from "@/lib/public";
import { getSignedInUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { Wordmark } from "@/components/Wordmark";
import { SampleTabs } from "@/components/SampleTabs";
import { PreviewBanner } from "@/components/PreviewBanner";
import { noIndex } from "@/lib/seo";
import type { Blueprint } from "@/lib/blueprint/types";
import type { SampleRow } from "@/lib/db/types";
import "../../../plan.css";

export const dynamic = "force-dynamic";

// never indexable: this page only ever shows an unpublished draft
export const metadata: Metadata = { title: "Sample plans — Yuzuu", ...noIndex };

/**
 * The three sample plans, shown to whoever can already see the unpublished
 * product — the creator previewing their own, or the creator being pitched a
 * spec build via their preview token.
 *
 * This is the answer to "couldn't I just do this with ChatGPT?": three
 * invented buyers, three genuinely different documents. Describing that in a
 * DM does not land; showing it does.
 *
 * Gated on isPreview, so it is unreachable once the product is published — at
 * that point the real thing is live and these drafts are history.
 */
export default async function SamplesPage({
  params,
  searchParams,
}: {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { handle } = await params;
  const { preview } = await searchParams;
  const viewer = await getSignedInUser();
  const { product, isPreview, previewKind } = await productForViewer(handle, viewer?.id, preview);
  if (!product || !isPreview) notFound();

  const db = supabaseAdmin();
  // Only the presentation template crosses the wire — never content_bank or
  // knowledge_pack, which are the blueprint IP.
  const { data: bpRow } = await db
    .from("blueprints")
    .select("data")
    .eq("id", product.blueprintId)
    .maybeSingle();
  const { data: sampleRows } = await db
    .from("samples")
    .select("*")
    .eq("blueprint_id", product.blueprintId)
    .order("created_at", { ascending: true });

  const bp = bpRow?.data as Blueprint | undefined;
  const samples = ((sampleRows ?? []) as SampleRow[]).slice(0, 3).map((s) => ({
    persona: s.persona,
    label: s.persona_label ?? s.persona,
    output: s.sections,
  }));
  if (!bp || samples.length === 0) notFound();

  const carry = previewKind === "token" ? `?preview=${encodeURIComponent(preview!)}` : "";

  return (
    <section>
      <header className="bar">
        <div className="bar-in">
          <Wordmark href="/" />
        </div>
      </header>
      <PreviewBanner kind={previewKind}>
        the three sample buyers we wrote plans for, before anyone sees your page.
      </PreviewBanner>
      <div className="wrap">
        <div style={{ maxWidth: 920, margin: "0 auto" }}>
          <div className="micro">Built from @{product.handle}</div>
          <h1 style={{ marginTop: 16 }}>{product.title}</h1>
          <p className="lede">
            We invented three very different buyers, took the quiz as each of them, and wrote
            each their own plan. Every real buyer gets one written the same way. Read two of
            them side by side &mdash; the differences are the product.
          </p>
          <div style={{ marginTop: 18 }}>
            <Link className="btn btn-outline" href={`/u/${product.handle}${carry}`}>
              Back to the page
            </Link>
          </div>

          <div style={{ marginTop: 28 }}>
            <SampleTabs
              samples={samples}
              template={bp.output.template}
              creatorName={product.creatorName}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
