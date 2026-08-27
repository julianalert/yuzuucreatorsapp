import { redirect } from "next/navigation";
import { requireCreator } from "@/lib/auth";
import { latestBuild, routeForBuild } from "@/lib/builds";
import { AppBar } from "@/components/AppBar";
import { BuildProgress } from "@/components/BuildProgress";

export default async function ScanningPage({
  searchParams,
}: {
  searchParams: Promise<{ rebuilding?: string }>;
}) {
  const { rebuilding } = await searchParams;
  const creator = await requireCreator();
  const build = await latestBuild(creator.id);
  if (!build) redirect("/onboard");
  const route = routeForBuild(build);
  if (route !== "/onboard/scanning") redirect(route);

  const initial = creator.display_name?.[0] ?? creator.email[0];

  return (
    <section>
      <AppBar initial={initial} avatarUrl={creator.avatar_url} />
      <div className="wrap">
        <div style={{ maxWidth: 560, margin: "60px auto 0" }}>
          <div className="micro">
            Step 1 of 3 · Reading @{creator.handle}
            {rebuilding ? " · rebuilding" : ""}
          </div>
          <h1 style={{ marginTop: 18 }}>
            {rebuilding
              ? "Rebuilding with your feedback in mind."
              : "Working out what you're known for."}
          </h1>

          <BuildProgress
            buildId={build.id}
            phase="scan"
            initialStage={build.stage}
            initialStatus={build.status}
          />

          <p style={{ marginTop: 30, fontSize: 14.5, color: "var(--sage)", maxWidth: "44ch" }}>
            You can close this tab. We&apos;ll email you when the ideas are ready.
          </p>
        </div>
      </div>
    </section>
  );
}
