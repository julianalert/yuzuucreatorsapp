import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { AdminNav } from "@/components/admin/AdminNav";
import { SampleTabs } from "@/components/admin/SampleTabs";
import type { SampleView } from "@/components/SampleReview";
import type { Blueprint } from "@/lib/blueprint/types";
import type { SampleRow } from "@/lib/db/types";
import "../../../../plan.css";

export const dynamic = "force-dynamic";

/**
 * The three sample plans for a build, for an admin.
 *
 * The creator's own /onboard/review is gated on requireCreator() + their
 * latest build, so it can't show a spec build — nobody can sign into that
 * account. This is the same documents, without the approve/reject decision,
 * which stays the creator's alone.
 */
export default async function AdminSamplesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const db = supabaseAdmin();

  const { data: build } = await db
    .from("builds")
    .select("id, status, creators(handle, is_spec)")
    .eq("id", id)
    .maybeSingle();
  if (!build) notFound();

  const { data: blueprint } = await db
    .from("blueprints")
    .select("id, data")
    .eq("build_id", id)
    .maybeSingle();

  const { data: sampleRows } = await db
    .from("samples")
    .select("*")
    .eq("blueprint_id", blueprint?.id ?? "")
    .order("created_at", { ascending: true });

  const creator = build.creators as unknown as { handle: string | null; is_spec: boolean } | null;
  const bp = blueprint?.data as Blueprint | undefined;
  const samples: SampleView[] = ((sampleRows ?? []) as SampleRow[]).slice(0, 3).map((s) => ({
    persona: s.persona,
    label: s.persona_label ?? s.persona,
    output: s.sections,
  }));

  return (
    <section>
      <AdminNav current="/admin" crumb={`samples ${id.slice(0, 8)}`} />
      <div className="wrap">
        <div style={{ maxWidth: 920, margin: "0 auto" }}>
          <div className="micro">
            @{creator?.handle ?? "—"}
            {creator?.is_spec ? " · spec build" : ""} · {build.status}
          </div>
          <h1 style={{ marginTop: 14 }}>Samples</h1>
          <p style={{ marginTop: 10, fontSize: 15, color: "var(--ink-soft)", maxWidth: "64ch" }}>
            Three invented buyers, each taken through the quiz and written their own plan. If
            these read as generic or interchangeable, the product is not worth pitching &mdash;
            that is what this page is for.
          </p>
          <div style={{ marginTop: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link className="btn btn-ghost btn-sm" href={`/admin/builds/${id}`}>
              Build inspector
            </Link>
            <Link className="btn btn-ghost btn-sm" href="/admin/spec">
              Spec builds
            </Link>
          </div>

          <div style={{ marginTop: 28 }}>
            {!bp || samples.length === 0 ? (
              <p className="dv-empty">
                No samples for this build yet — they are written at the end of the pipeline,
                just before it parks for review.
              </p>
            ) : (
              <SampleTabs
                samples={samples}
                template={bp.output.template}
                creatorName={bp.creator?.display_name ?? `@${creator?.handle ?? ""}`}
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
