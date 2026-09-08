import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { absoluteUrl } from "@/lib/seo";
import { Wordmark } from "@/components/Wordmark";
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
  build: Pick<BuildRow, "id" | "status" | "stage" | "cost_usd" | "error"> | null;
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
          .select("id, status, stage, cost_usd, error")
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
      <header className="bar">
        <div className="bar-in wide">
          <Wordmark href="/dashboard" />
          <span className="micro">Admin</span>
          <div className="right">
            <Link className="btn btn-ghost btn-sm" href="/admin">
              Builds
            </Link>
            <Link className="btn btn-ghost btn-sm" href="/admin/payouts">
              Payouts
            </Link>
          </div>
        </div>
      </header>

      <div className="wrap wide">
        <h1>Spec builds</h1>
        <p className="micro" style={{ maxWidth: 620 }}>
          Build the product first, then pitch it. The account is real but nobody can sign into
          it, the page is not public, and it only goes live when the creator approves the
          samples themselves.
        </p>

        <div className="card" style={{ marginTop: 22 }}>
          <form action={createSpecBuild} className="stack">
            <label className="field">
              <span>Instagram handle</span>
              <input name="handle" placeholder="creatorhandle" required autoComplete="off" />
            </label>
            <label className="field">
              <span>What they&rsquo;re about (optional)</span>
              <input
                name="self_description"
                placeholder="leave blank to use their bio"
                autoComplete="off"
              />
            </label>
            <SubmitButton
              label="Build it"
              pendingLabel="Starting…"
              className="btn btn-primary"
              hint={`${rows.length} open · $${spend.toFixed(2)} spent`}
            />
          </form>
          <Flash q={q} />
        </div>

        <div className="card" style={{ marginTop: 26 }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Creator</th>
                <th>Build</th>
                <th>Cost</th>
                <th>Preview</th>
                <th>Hand over</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="micro">
                    No spec builds open.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      @{r.handle}
                      <br />
                      <span className="micro">{r.email}</span>
                    </td>
                    <td>
                      {r.build ? (
                        <>
                          {r.build.status}
                          {r.build.stage ? <span className="micro"> · {r.build.stage}</span> : null}
                          {r.build.error ? (
                            <>
                              <br />
                              <span className="micro">{r.build.error}</span>
                            </>
                          ) : null}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="mono">${(r.build?.cost_usd ?? 0).toFixed(2)}</td>
                    <td>
                      {r.previewUrl ? (
                        <CopyLink url={r.previewUrl} />
                      ) : (
                        <span className="micro">not ready</span>
                      )}
                    </td>
                    <td>
                      <form action={handOverSpecCreator} className="row">
                        <input type="hidden" name="creator_id" value={r.id} />
                        <input
                          name="email"
                          type="email"
                          placeholder="their@email.com"
                          required
                          autoComplete="off"
                        />
                        <button type="submit" className="btn btn-outline btn-sm">
                          Hand over
                        </button>
                      </form>
                    </td>
                    <td>
                      <form action={discardSpecCreator}>
                        <input type="hidden" name="creator_id" value={r.id} />
                        <DiscardButton handle={r.handle} />
                      </form>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
