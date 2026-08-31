import { redirect } from "next/navigation";
import { latestGuestBuild, readGuestToken, routeForGuestBuild } from "@/lib/guest";
import { BuildProgress } from "@/components/BuildProgress";

/** Guest mirror of /onboard/scanning — no account yet, so no "we'll email
 * you" promise: the visitor needs to keep the tab open. */
export default async function GuestScanningPage({
  searchParams,
}: {
  searchParams: Promise<{ rebuilding?: string }>;
}) {
  const { rebuilding } = await searchParams;
  const token = await readGuestToken();
  const build = token ? await latestGuestBuild(token) : null;
  if (!build) redirect("/");
  const route = routeForGuestBuild(build);
  if (route !== "/start/scanning") redirect(route);

  return (
    <section>
      <div className="wrap">
        <div style={{ maxWidth: 560, margin: "60px auto 0" }}>
          <div className="micro">
            Step 1 of 3 · Reading @{build.handle}
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
            guest
          />

          <p style={{ marginTop: 30, fontSize: 14.5, color: "var(--sage)", maxWidth: "44ch" }}>
            Takes about a minute — keep this tab open. Your product ideas appear right here.
          </p>
        </div>
      </div>
    </section>
  );
}
