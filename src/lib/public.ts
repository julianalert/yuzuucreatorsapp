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

export async function publishedProductByHandle(handle: string): Promise<PublicProduct | null> {
  const admin = supabaseAdmin();
  const { data: creator } = await admin
    .from("creators")
    .select("id, handle, display_name, avatar_url")
    .eq("handle", handle.toLowerCase())
    .maybeSingle();
  if (!creator) return null;

  const { data: row } = await admin
    .from("blueprints")
    .select("*")
    .eq("creator_id", creator.id)
    .eq("published", true)
    .maybeSingle();
  if (!row) return null;

  const bp = (row as BlueprintRow).data as Blueprint;

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
    version: (row as BlueprintRow).version,
    priceCents: (row as BlueprintRow).price_cents,
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
