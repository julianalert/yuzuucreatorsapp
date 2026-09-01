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

  const initial = creator.display_name?.[0] ?? creator.email[0];

  return (
    <section>
      <AppBar initial={initial} avatarUrl={creator.avatar_url} />
      <div className="wrap">
        <div style={{ maxWidth: 560, margin: "60px auto 0" }}>
          <div className="micro">Step 3 of 3 · Building</div>
          <h1 style={{ marginTop: 18 }}>{build.chosen_topic?.topic_title ?? "Building your product"}</h1>
          <p className="lede">
            This will take a few minutes. Nothing goes live until you&apos;ve read the samples and
            approved it.
          </p>

          <BuildProgress
            buildId={build.id}
            phase="build"
            initialStage={build.stage}
            initialStatus={build.status}
          />

          <p className="notice-info" style={{ marginTop: 30 }}>
            You can close this tab. We&apos;ll email you when ready.
          </p>
        </div>
      </div>
    </section>
  );
}
