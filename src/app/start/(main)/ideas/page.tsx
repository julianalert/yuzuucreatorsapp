import { redirect } from "next/navigation";
import { latestGuestBuild, readGuestToken, routeForGuestBuild } from "@/lib/guest";
import { IdeaPicker } from "@/components/IdeaPicker";
import { DEFAULT_PRICE_CENTS } from "@/lib/pipeline/constants";
import { CREATOR_KEEP_PCT } from "@/lib/seo";
import { chooseTopicGuest, discardGuestBuild, regenerateIdeasGuest } from "../../actions";

/** Their audience's own words — the receipts behind the ideas. */
function receiptsFrom(evidence?: Record<string, string[]>, fallback?: string[]): string[] {
  const quotes = evidence
    ? Object.values(evidence)
        .flat()
        .filter((q) => typeof q === "string" && q.trim().length > 12)
    : [];
  const source = quotes.length ? quotes : (fallback ?? []);
  return [...new Set(source)].slice(0, 3);
}

/** Guest mirror of /onboard/ideas — the value-first moment. Picking an idea
 * is where signup happens: the chosen index is saved and the visitor goes
 * through Google auth, then /start/claim resumes the build. */
export default async function GuestIdeasPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const token = await readGuestToken();
  const build = token ? await latestGuestBuild(token) : null;
  if (!build) redirect("/");
  const route = routeForGuestBuild(build);
  if (route !== "/start/ideas") redirect(route);

  const proposals = build.topic_proposals?.proposals ?? [];
  const receipts = receiptsFrom(
    build.audience_card?.evidence,
    build.audience_card?.audience_words
  );
  const priceUsd = (DEFAULT_PRICE_CENTS / 100).toFixed(0);
  const keepUsd = ((DEFAULT_PRICE_CENTS * CREATOR_KEEP_PCT) / 100 / 100).toFixed(2);

  return (
    <section>
      <div className="wrap">
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <div className="micro">Step 2 of 3 · @{build.handle}</div>
          <h1 style={{ marginTop: 18 }}>
            {proposals.length === 1
              ? "One product your audience would buy."
              : `${["", "One", "Two", "Three", "Four", "Five"][proposals.length] ?? proposals.length} products your audience would buy.`}
          </h1>
          <p className="lede">
            Each one comes from something you&apos;ve already said and something they keep asking.
            Pick one — you&apos;ll sign in with Google (ten seconds, free) and we build the whole
            thing.
          </p>

          {error === "regen_limit" ? (
            <div className="notice" style={{ marginTop: 18 }}>
              You&apos;ve regenerated ideas twice already — that&apos;s the limit. Pick the
              closest fit, or start over with a different account.
            </div>
          ) : null}

          {receipts.length ? (
            <div className="receipts">
              <span className="micro">What your audience keeps saying</span>
              <div className="receipt-list">
                {receipts.map((r) => (
                  <blockquote key={r} className="receipt">
                    “{r}”
                  </blockquote>
                ))}
              </div>
            </div>
          ) : null}

          <IdeaPicker
            proposals={proposals}
            buildId={build.id}
            priceUsd={priceUsd}
            keepUsd={keepUsd}
            action={chooseTopicGuest}
            regenerateAction={regenerateIdeasGuest}
            discardAction={discardGuestBuild}
          />
        </div>
      </div>
    </section>
  );
}
