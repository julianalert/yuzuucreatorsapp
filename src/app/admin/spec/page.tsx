import { AdminNav } from "@/components/admin/AdminNav";
import { requireAdmin } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { absoluteUrl } from "@/lib/seo";
import { SubmitButton } from "@/components/SubmitButton";
import { CopyLink, DiscardButton } from "./SpecRowControls";
import { createSpecBuild, handOverSpecCreator, discardSpecCreator } from "./actions";
import type { BuildRow } from "@/lib/db/types";

export const dynamic = "force-dynamic";

interface SpecRow {
  id: string;
  handle: string;
  email: string;
  createdAt: string;
  build: Pick<BuildRow, "id" | "status" | "stage" | "halted_at" | "cost_usd" | "error"> | null;
  previewUrl: string | null;
}

async function loadSpecRows(): Promise<SpecRow[]> {
  const admin = supabaseAdmin();
  const { data: creators } = await admin
    .from("creators")
    .select("id, handle, email, created_at")
    .eq("is_spec", true)
    .order("created_at", { ascending: false });

  return Promise.all(
    (creators ?? []).map(async (c) => {
      const [{ data: build }, { data: bp }] = await Promise.all([
        admin
          .from("builds")
          .select("id, status, stage, halted_at, cost_usd, error")
          .eq("creator_id", c.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        // the same row productForViewer() will resolve: latest complete draft
        admin
          .from("blueprints")
          .select("preview_token")
          .eq("creator_id", c.id)
          .eq("status", "complete")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      return {
        id: c.id,
        handle: c.handle ?? "—",
        email: c.email,
        createdAt: c.created_at,
        build: (build as SpecRow["build"]) ?? null,
        previewUrl: bp?.preview_token
          ? absoluteUrl(`/u/${c.handle}?preview=${bp.preview_token}`)
          : null,
      };
    })
  );
}

function Flash({ q }: { q: Record<string, string | undefined> }) {
  const msg = q.error
    ? { tone: "err", text: q.error }
    : q.started
      ? { tone: "ok", text: `Building @${q.started} — it lands in the table below.` }
      : q.handed
        ? {
            tone: "ok",
            text: `@${q.handed} handed over. They sign in with Google at that address and the product is waiting.`,
          }
        : q.discarded
          ? { tone: "ok", text: `@${q.discarded} deleted. The handle is free again.` }
          : null;
  if (!msg) return null;
  return (
    <p
      className="micro"
      style={{
        color: msg.tone === "err" ? "var(--rust, #b4432a)" : "var(--sage)",
        marginTop: 14,
      }}
    >
      {msg.text}
    </p>
  );
}

/**
 * Spec builds: pre-build a product from a creator's public Instagram, pitch it
 * with a private preview link, hand the account over if they say yes.
 *
 * Nothing here publishes. A spec product stays invisible at /u/<handle> until
 * the creator signs in and approves the samples themselves, which is the same
 * gate every other creator goes through.
 */
export default async function SpecPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  const q = await searchParams;
  const rows = await loadSpecRows();
  const spend = rows.reduce((s, r) => s + (r.build?.cost_usd ?? 0), 0);

  return (
    <section>
      <AdminNav current="/admin/spec" />

      <div className="wrap wide">
        <h1>Spec builds</h1>
        <p style={{ marginTop: 10, maxWidth: "62ch", fontSize: 15, color: "var(--ink-soft)" }}>
          Build the product first, then pitch it. The account is real but nobody can sign into
          it, the page is not public, and it only goes live once the creator approves the
          samples themselves.
        </p>

        <div className="card" style={{ marginTop: 24 }}>
          <form action={createSpecBuild}>
            <label className="form-label" htmlFor="handle">
              Instagram handle
            </label>
            <div className="field">
              <span className="at">@</span>
              <input
                className="with-at"
                id="handle"
                name="handle"
                type="text"
                placeholder="creatorhandle"
                spellCheck={false}
                autoComplete="off"
                required
              />
            </div>

            <div style={{ marginTop: 22 }}>
              <label className="form-label" htmlFor="sd">
                What they&rsquo;re about{" "}
                <span style={{ color: "var(--sage)", fontWeight: 400 }}>
                  (optional — leave blank to use their bio)
                </span>
              </label>
              <textarea
                className="area"
                id="sd"
                name="self_description"
                rows={2}
                placeholder="sleep coaching for parents of toddlers"
              />
            </div>

            <div style={{ marginTop: 22, display: "flex", alignItems: "center", gap: 14 }}>
              <SubmitButton
                label="Build it"
                pendingLabel="Starting\u2026"
                className="btn btn-primary"
                hint={`${rows.length} open \u00b7 $${spend.toFixed(2)} spent`}
              />
            </div>
          </form>
          <Flash q={q} />
        </div>

        <h2 style={{ marginTop: 40 }}>Open builds</h2>

        {rows.length === 0 ? (
          <div className="card" style={{ marginTop: 14 }}>
            <p className="dv-empty">
              No spec builds open. Enter a handle above to build one.
            </p>
          </div>
        ) : (
          <div style={{ marginTop: 14 }}>
            {rows.map((r) => {
              const status = r.build?.status ?? "queued";
              const ready = status === "awaiting_approval";
              const broken = status === "failed" || status === "declined";
              return (
                <div className="card spec-item" key={r.id}>
                  <div className="spec-head">
                    <h3>@{r.handle}</h3>
                    <span className={`badge${ready ? "" : broken ? " bad" : " grey"}`}>
                      {ready ? "ready to pitch" : broken ? (r.build?.halted_at ?? status) : status}
                    </span>
                    <div className="spec-actions">
                      {r.previewUrl ? (
                        <CopyLink url={r.previewUrl} />
                      ) : (
                        <span className="micro">preview not ready</span>
                      )}
                      <form action={discardSpecCreator}>
                        <input type="hidden" name="creator_id" value={r.id} />
                        <DiscardButton handle={r.handle} />
                      </form>
                    </div>
                  </div>

                  <div className="spec-meta">
                    {r.email} &middot; ${(r.build?.cost_usd ?? 0).toFixed(2)}
                    {r.build?.stage ? ` \u00b7 ${r.build.stage}` : ""}
                  </div>
                  {r.build?.error ? (
                    <p style={{ marginTop: 10, fontSize: 13.5, color: "var(--rust)" }}>
                      {r.build.error}
                    </p>
                  ) : null}

                  <hr className="spec-rule" />

                  <label className="form-label" htmlFor={`email-${r.id}`}>
                    Hand over to{" "}
                    <span style={{ color: "var(--sage)", fontWeight: 400 }}>
                      their real email &mdash; they sign in with Google at that address
                    </span>
                  </label>
                  <form action={handOverSpecCreator} className="inline-form">
                    <input type="hidden" name="creator_id" value={r.id} />
                    <div className="field">
                      <input
                        id={`email-${r.id}`}
                        name="email"
                        type="email"
                        placeholder="them@gmail.com"
                        autoComplete="off"
                        required
                      />
                    </div>
                    <button type="submit" className="btn btn-outline">
                      Hand over
                    </button>
                  </form>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
