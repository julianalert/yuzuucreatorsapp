import { redirect } from "next/navigation";
import { requireCreator } from "@/lib/auth";
import { latestBuild, routeForBuild } from "@/lib/builds";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { AppBar } from "@/components/AppBar";
import { SampleReview, type SampleView } from "@/components/SampleReview";
import { reviewSamples } from "../actions";
import type { Blueprint } from "@/lib/blueprint/types";
import type { SampleRow } from "@/lib/db/types";
import "../../plan.css";

export default async function ReviewPage() {
  const creator = await requireCreator();
  const build = await latestBuild(creator.id);
  if (!build) redirect("/onboard");
  const route = routeForBuild(build);
  if (route !== "/onboard/review") redirect(route);

  const admin = supabaseAdmin();
  const { data: blueprint } = await admin
    .from("blueprints")
    .select("id, data")
    .eq("build_id", build.id)
    .single();
  const { data: sampleRows } = await admin
    .from("samples")
    .select("*")
    .eq("blueprint_id", blueprint?.id ?? "")
    .order("created_at", { ascending: true });

  const bp = blueprint?.data as Blueprint;
  const samples: SampleView[] = ((sampleRows ?? []) as SampleRow[]).slice(0, 3).map((s) => ({
    persona: s.persona,
    label: s.persona_label ?? s.persona,
    output: s.sections,
  }));

  const initial = creator.display_name?.[0] ?? creator.email[0];
  const creatorName = creator.display_name ?? `@${creator.handle ?? ""}`;

  return (
    <section>
      <AppBar initial={initial} avatarUrl={creator.avatar_url} />
      <div className="wrap">
        <div style={{ maxWidth: 920, margin: "0 auto" }}>
          <div className="micro">Ready for you</div>
          <h1 style={{ marginTop: 18 }}>Read three plans before this goes live.</h1>
          <p className="lede">
            We invented three very different buyers and wrote each their own plan — exactly how
            every real buyer&apos;s will be written. If any of it doesn&apos;t sound like you, say
            so and we&apos;ll rebuild it.
          </p>

          <SampleReview
            samples={samples}
            template={bp.output.template}
            creatorName={creatorName}
            buildId={build.id}
            handle={creator.handle ?? ""}
            action={reviewSamples}
          />
        </div>
      </div>
    </section>
  );
}
