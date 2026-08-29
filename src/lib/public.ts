import "server-only";
import { supabaseAdmin } from "./supabase/admin";
import type { Blueprint, QuizQuestion } from "./blueprint/types";
import type { BlueprintRow } from "./db/types";

/** Quiz shape safe to ship to the buyer's browser. */
export interface PublicQuizQuestion {
  id: string;
  question: string;
  type: "single" | "multi";
  required: boolean;
  help?: string;
  options: { id: string; label: string; sub?: string }[];
}

/** Template section info safe for marketing pages. */
export interface PublicSection {
  id: string;
  title: string;
  description?: string;
  eyebrow: string;
}

/** Everything a public page needs — never includes knowledge_pack or the generation prompt. */
export interface PublicProduct {
  blueprintId: string;
  version: number;
  priceCents: number;
  handle: string;
  creatorName: string;
  creatorAvatarUrl: string | null;
  credibility?: string;
  title: string;
  promise: string;
  durationDays: number | null;
  sections: PublicSection[];
  sectionTitles: string[];
  questions: PublicQuizQuestion[];
}

interface PublicCreator {
  id: string;
  user_id: string;
  handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

function toPublicProduct(row: BlueprintRow, creator: PublicCreator): PublicProduct {
  const bp = row.data as Blueprint;

  const questions: PublicQuizQuestion[] = (bp.quiz?.questions ?? []).map((q: QuizQuestion) => ({
    id: q.id,
    question: q.question,
    type: q.type,
    required: q.required !== false,
    help: q.help,
    options: (q.options ?? []).map((o) => ({
      id: o.value,
      label: o.label,
      sub: o.sub,
    })),
  }));

  return {
    blueprintId: row.id,
    version: row.version,
    priceCents: row.price_cents,
    handle: creator.handle!,
    creatorName: creator.display_name ?? bp.creator?.display_name ?? `@${creator.handle}`,
    creatorAvatarUrl: creator.avatar_url ?? null,
    credibility: bp.creator?.credibility_statement,
    title: bp.product?.topic_title ?? "",
    promise: bp.product?.promise ?? "",
    durationDays: bp.product?.duration_days ?? null,
    sections: (bp.output?.template?.sections ?? []).map((s) => ({
      id: s.id,
      title: s.title,
      description: s.description,
      eyebrow: s.eyebrow,
    })),
    sectionTitles: (bp.output?.template?.sections ?? []).map((s) => s.title),
    questions,
  };
}

async function creatorByHandle(handle: string): Promise<PublicCreator | null> {
  const { data } = await supabaseAdmin()
    .from("creators")
    .select("id, user_id, handle, display_name, avatar_url")
    .eq("handle", handle.toLowerCase())
    .maybeSingle();
  return (data as PublicCreator) ?? null;
}

export async function publishedProductByHandle(handle: string): Promise<PublicProduct | null> {
  const creator = await creatorByHandle(handle);
  if (!creator) return null;

  const { data: row } = await supabaseAdmin()
    .from("blueprints")
    .select("*")
    .eq("creator_id", creator.id)
    .eq("published", true)
    .maybeSingle();
  if (!row) return null;

  return toPublicProduct(row as BlueprintRow, creator);
}

/**
 * Resolve the product for a specific viewer. The creator viewing their own
 * page gets preview mode: their live page if published, otherwise their
 * latest finished-but-unpublished blueprint (the one awaiting approval) — so
 * they can walk the follower journey before going live, and their own visits
 * never count as buyer traffic.
 */
export async function productForViewer(
  handle: string,
  viewerUserId: string | null | undefined
): Promise<{ product: PublicProduct | null; isPreview: boolean }> {
  const creator = await creatorByHandle(handle);
  if (!creator) return { product: null, isPreview: false };
  const isOwner = Boolean(viewerUserId) && creator.user_id === viewerUserId;

  const admin = supabaseAdmin();
  const { data: published } = await admin
    .from("blueprints")
    .select("*")
    .eq("creator_id", creator.id)
    .eq("published", true)
    .maybeSingle();

  if (published) {
    return { product: toPublicProduct(published as BlueprintRow, creator), isPreview: isOwner };
  }
  if (!isOwner) return { product: null, isPreview: false };

  // owner, nothing live: preview the latest complete draft (pre-approval)
  const { data: draft } = await admin
    .from("blueprints")
    .select("*")
    .eq("creator_id", creator.id)
    .eq("status", "complete")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!draft) return { product: null, isPreview: false };
  return { product: toPublicProduct(draft as BlueprintRow, creator), isPreview: true };
}

export async function listPublishedHandles(): Promise<
  { handle: string; lastModified: Date }[]
> {
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("blueprints")
    .select("approved_at, created_at, creators!inner(handle)")
    .eq("published", true);

  if (error || !data) return [];

  const seen = new Set<string>();
  const out: { handle: string; lastModified: Date }[] = [];
  for (const row of data) {
    const creator = row.creators as { handle: string | null } | { handle: string | null }[] | null;
    const handle = Array.isArray(creator) ? creator[0]?.handle : creator?.handle;
    if (!handle || seen.has(handle)) continue;
    seen.add(handle);
    const stamp = row.approved_at ?? row.created_at;
    out.push({ handle, lastModified: stamp ? new Date(stamp) : new Date() });
  }
  return out;
}
