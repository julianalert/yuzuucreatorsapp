import { redirect } from "next/navigation";
import { requireCreator } from "@/lib/auth";
import { latestBuild, routeForBuild } from "@/lib/builds";
import { AppBar } from "@/components/AppBar";
import { startBuild } from "./actions";

const ERRORS: Record<string, string> = {
  handle: "That doesn't look like an Instagram handle — letters, numbers, dots and underscores only.",
  limit: "You've hit the build limit for this account. Get in touch if you need another run.",
  taken: "That handle is already connected to another Yuzuu account.",
};

const HALT_NOTES: Record<string, string> = {
  thin_content:
    "Your account came back with too little public content for us to read your audience. If your account is private, make it public and try again.",
  audience_confidence:
    "We couldn't read your audience confidently enough from what's public — we'd rather decline than build something mediocre with your name on it.",
  no_viable_topic:
    "We couldn't find a product angle segmentable enough to personalize honestly for your audience. This isn't a judgement of your content — some niches just don't split into different buyer situations yet.",
  structural_validation: "The build failed one of our quality checks. Run it again — this is usually transient.",
  swap_test:
    "The build produced plans that weren't different enough between buyer types, twice. We stopped rather than ship personalization theater. Try again, or pick a different idea next time.",
  quality_gate: "The samples scored below our quality bar, so we didn't show them to you. Run it again.",
  rejected_by_creator: "You rejected the samples — we're rebuilding with your feedback in mind.",
  topic_timeout: "The ideas expired before one was picked. Start again — it only takes a minute.",
  review_timeout: "The samples expired before you reviewed them. Start again and we'll rebuild.",
};

export default async function OnboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; new?: string }>;
}) {
  const { error, new: startNew } = await searchParams;
  const creator = await requireCreator();
  const build = await latestBuild(creator.id);

  if (build && !startNew && !error) {
    const route = routeForBuild(build);
    if (route !== "/onboard") redirect(route);
  }

  const halted = build && (build.status === "declined" || build.status === "failed");
  const initial = creator.display_name?.[0] ?? creator.email[0];

  return (
    <section>
      <AppBar initial={initial} />
      <div className="wrap">
        <div style={{ maxWidth: 560, margin: "60px auto 0" }}>
          <div className="micro">Step 1 of 3</div>
          <h1 style={{ marginTop: 18 }}>What&apos;s your Instagram?</h1>
          <p className="lede">
            We read your bio, your captions, and what your audience says in the comments. That
            last part is what makes the product actually fit them.
          </p>

          {error ? (
            <div className="notice warn" style={{ marginTop: 24 }}>
              {ERRORS[error] ?? "Something went wrong — try again."}
            </div>
          ) : null}

          {halted && !error ? (
            <div className="notice warn" style={{ marginTop: 24 }}>
              <b style={{ display: "block", marginBottom: 6 }}>
                {build.status === "declined"
                  ? "We couldn't build this one yet"
                  : "The last build stopped"}
              </b>
              {HALT_NOTES[build.halted_at ?? ""] ??
                build.error ??
                "Something went wrong on our side. Try again."}
            </div>
          ) : null}

          <form action={startBuild}>
            <div className="field" style={{ marginTop: 32 }}>
              <span className="at">@</span>
              <input
                className="with-at"
                type="text"
                name="handle"
                placeholder="yourhandle"
                defaultValue={creator.handle ?? ""}
                spellCheck={false}
                autoComplete="off"
                required
              />
            </div>
            <p style={{ marginTop: 12, fontSize: 13.5, color: "var(--sage)" }}>
              Public accounts only. We don&apos;t post anything or follow anyone.
            </p>

            <div style={{ marginTop: 26 }}>
              <label className="form-label" htmlFor="sd">
                What do you help people with?{" "}
                <span style={{ color: "var(--sage)", fontWeight: 400 }}>(optional, one line)</span>
              </label>
              <textarea
                className="area"
                id="sd"
                name="self_description"
                rows={2}
                placeholder="e.g. I help owners of pulling, reactive dogs get calm walks."
              />
            </div>

            <div style={{ marginTop: 32, display: "flex", gap: 14, alignItems: "center" }}>
              <button className="btn btn-primary btn-lg" type="submit">
                Read my account
              </button>
              <span style={{ fontSize: 13.5, color: "var(--sage)" }}>Takes about a minute</span>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
