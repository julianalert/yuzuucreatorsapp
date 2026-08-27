import { redirect } from "next/navigation";
import { requireCreator } from "@/lib/auth";
import { latestBuild, routeForBuild } from "@/lib/builds";
import { AppBar } from "@/components/AppBar";
import { IdeaPicker } from "@/components/IdeaPicker";
import { chooseTopic } from "../actions";

export default async function IdeasPage() {
  const creator = await requireCreator();
  const build = await latestBuild(creator.id);
  if (!build) redirect("/onboard");
  const route = routeForBuild(build);
  if (route !== "/onboard/ideas") redirect(route);

  const proposals = build.topic_proposals?.proposals ?? [];
  const initial = creator.display_name?.[0] ?? creator.email[0];

  return (
    <section>
      <AppBar initial={initial} avatarUrl={creator.avatar_url} />
      <div className="wrap">
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <div className="micro">Step 2 of 3</div>
          <h1 style={{ marginTop: 18 }}>
            {proposals.length === 1
              ? "One product your audience would buy."
              : `${["", "One", "Two", "Three", "Four", "Five"][proposals.length] ?? proposals.length} products your audience would buy.`}
          </h1>
          <p className="lede">
            Each one comes from something you&apos;ve already said and something they keep asking.
            Pick one — the rest happens automatically.
          </p>

          <IdeaPicker proposals={proposals} buildId={build.id} action={chooseTopic} />
        </div>
      </div>
    </section>
  );
}
