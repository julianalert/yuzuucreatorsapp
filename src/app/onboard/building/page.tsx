import { redirect } from "next/navigation";
import { requireCreator } from "@/lib/auth";
import { latestBuild, routeForBuild } from "@/lib/builds";
import { AppBar } from "@/components/AppBar";
import { BuildProgress } from "@/components/BuildProgress";

export default async function BuildingPage() {
  const creator = await requireCreator();
  const build = await latestBuild(creator.id);
  if (!build) redirect("/onboard");
  const route = routeForBuild(build);
  if (route !== "/onboard/building") redirect(route);

  const archetypeHint = "one for each kind of buyer your quiz can identify";
  const initial = creator.display_name?.[0] ?? creator.email[0];

  return (
    <section>
      <AppBar initial={initial} avatarUrl={creator.avatar_url} />
      <div className="wrap">
        <div style={{ maxWidth: 560, margin: "60px auto 0" }}>
          <div className="micro">Step 3 of 3 · Building</div>
          <h1 style={{ marginTop: 18 }}>{build.chosen_topic?.topic_title ?? "Building your product"}</h1>
          <p className="lede">
            This one takes a few minutes. We&apos;re writing several different versions of the
            plan, {archetypeHint}.
          </p>

          <BuildProgress
            buildId={build.id}
            phase="build"
            initialStage={build.stage}
            initialStatus={build.status}
          />

          <div className="card" style={{ marginTop: 30, padding: "20px 22px" }}>
            <p style={{ fontSize: 14.5, color: "var(--ink-soft)", lineHeight: 1.6 }}>
              Nothing goes live until you&apos;ve read three sample plans and approved them.
              We&apos;ll email you when they&apos;re ready.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
