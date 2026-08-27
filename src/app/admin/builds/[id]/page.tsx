import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { Wordmark } from "@/components/Wordmark";
import type { BuildRow } from "@/lib/db/types";

export const dynamic = "force-dynamic";

function Json({ label, value }: { label: string; value: unknown }) {
  if (value == null) return null;
  return (
    <div className="card" style={{ marginTop: 14 }}>
      <span className="micro">{label}</span>
      <pre
        style={{
          marginTop: 12,
          fontFamily: "var(--mono)",
          fontSize: 12,
          lineHeight: 1.6,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          maxHeight: 420,
          overflowY: "auto",
        }}
      >
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

export default async function AdminBuildPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const admin = supabaseAdmin();

  const { data: buildRow } = await admin
    .from("builds")
    .select("*, creators(handle, email)")
    .eq("id", id)
    .maybeSingle();
  if (!buildRow) notFound();
  const build = buildRow as BuildRow & {
    creators: { handle: string | null; email: string } | null;
  };

  const { data: blueprint } = await admin
    .from("blueprints")
    .select("id, status, version, published, price_cents")
    .eq("build_id", id)
    .maybeSingle();

  const facts: [string, string][] = [
    ["Creator", `@${build.creators?.handle ?? "—"} (${build.creators?.email ?? "—"})`],
    ["Status", build.status],
    ["Stage", build.stage ?? "—"],
    ["Halted at", build.halted_at ?? "—"],
    ["Cost", `$${(build.cost_usd ?? 0).toFixed(2)}`],
    ["Started", new Date(build.created_at).toLocaleString()],
    ["Completed", build.completed_at ? new Date(build.completed_at).toLocaleString() : "—"],
    ["Reject reason", build.reject_reason ?? "—"],
    ["Error", build.error ?? "—"],
    [
      "Blueprint",
      blueprint
        ? `${blueprint.id} · v${blueprint.version} · ${blueprint.status}${blueprint.published ? " · published" : ""}`
        : "—",
    ],
  ];

  return (
    <section>
      <header className="bar">
        <div className="bar-in wide">
          <Wordmark href="/dashboard" />
          <span className="micro">Admin · build {id.slice(0, 8)}</span>
          <div className="right">
            <Link className="btn btn-ghost btn-sm" href="/admin">
              All builds
            </Link>
          </div>
        </div>
      </header>
      <div className="wrap wide">
        <h1>Build inspector</h1>

        <div className="card" style={{ marginTop: 26 }}>
          <table className="tbl">
            <tbody>
              {facts.map(([k, v]) => (
                <tr key={k}>
                  <td className="mono" style={{ width: 180, color: "var(--sage)" }}>
                    {k}
                  </td>
                  <td>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Json label="Critic results" value={build.critic_results} />
        <Json label="Audience card" value={build.audience_card} />
        <Json label="Topic proposals" value={build.topic_proposals} />
        <Json label="Chosen topic" value={build.chosen_topic} />
      </div>
    </section>
  );
}
