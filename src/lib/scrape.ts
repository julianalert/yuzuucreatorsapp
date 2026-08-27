/**
 * ScrapeCreators client, ported from harness/scrape.mjs. Same field probing
 * (response shapes are not a stable contract), same comment filtering: keep
 * comments where someone describes their own problem, drop praise/tags/emoji,
 * rank by first-person problem markers.
 */

const BASE = "https://api.scrapecreators.com";

async function api(endpoint: string, params: Record<string, string | number | boolean>) {
  const key = process.env.SCRAPECREATORS_API_KEY;
  if (!key) throw new Error("SCRAPECREATORS_API_KEY not set");
  const url = new URL(BASE + endpoint);
  for (const [k, v] of Object.entries(params)) if (v != null) url.searchParams.set(k, String(v));
  const res = await fetch(url, { headers: { "x-api-key": key } });
  if (!res.ok) throw new Error(`${endpoint} → ${res.status} ${await res.text().catch(() => "")}`);
  return res.json();
}

/** Probe several plausible paths rather than hardcoding one. */
/* eslint-disable @typescript-eslint/no-explicit-any */
const pick = (obj: any, ...paths: string[]) => {
  for (const p of paths) {
    const v = p.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);
    if (v != null && v !== "") return v;
  }
  return undefined;
};

const postsOf = (r: any): any[] => pick(r, "items", "data.items", "posts", "data") ?? [];
const captionOf = (p: any): string =>
  pick(p, "caption.text", "caption", "edge_media_to_caption.edges.0.node.text", "text") ?? "";
const commentCountOf = (p: any): number =>
  Number(pick(p, "comment_count", "comments_count", "edge_media_to_comment.count") ?? 0);
const shortcodeOf = (p: any) => pick(p, "code", "shortcode", "id");
const commentsOf = (r: any): any[] => pick(r, "comments", "data.comments", "items", "data.items") ?? [];
const commentTextOf = (c: any): string => pick(c, "text", "comment.text", "node.text") ?? "";

/** First line of a caption, which is where creators state their position. */
function captionHook(text: string): string {
  const line = String(text).split("\n").map((l) => l.trim()).find((l) => l.length > 25);
  return (line ?? "").replace(/\s+#\w+/g, "").replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "").trim();
}

const PRAISE = /^(love|amazing|yes+|this|so good|great|thank you|thanks|beautiful|perfect|wow|omg|❤|🔥|👏|😍)/i;

/**
 * Keep comments where someone describes their own problem. Those are the ones
 * stage 1 actually uses; praise and tags are noise that dilutes the prompt.
 */
export function usefulComments(raw: any[]): string[] {
  const seen = new Set<string>();
  return raw
    .map((c) => commentTextOf(c).replace(/\s+/g, " ").trim())
    .filter((t) => {
      if (t.length < 25 || t.length > 400) return false;
      if (/^@/.test(t)) return false; // pure tag
      if ((t.match(/@\w+/g) ?? []).length > 1) return false; // tag chain
      if (PRAISE.test(t) && t.length < 60) return false; // short praise
      if (!/[a-z]{3}/i.test(t)) return false; // emoji only
      const key = t.toLowerCase().slice(0, 40);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((t) => ({
      text: t,
      // first-person problem language is the signal we actually want
      score:
        (/\b(i|i'm|im|my|me|we)\b/i.test(t) ? 2 : 0) +
        (/\?/.test(t) ? 2 : 0) +
        (/\b(how|why|what|should|can'?t|won'?t|always|never|keep|still|tried)\b/i.test(t) ? 1 : 0),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 20)
    .map((c) => c.text);
}

export interface ScrapeResult {
  handle: string;
  bio: string;
  fullName: string;
  captions: string[];
  comments: string[];
  raw: { profile: unknown; posts: unknown };
  /** Under 8 usable comments produces a weak audience card. */
  thin: boolean;
}

export async function scrapeCreator(
  rawHandle: string,
  { postsForComments = 4 }: { postsForComments?: number } = {}
): Promise<ScrapeResult> {
  const handle = rawHandle.replace(/^@/, "").trim().toLowerCase();

  const profile = await api("/v1/instagram/profile", { handle });
  const bio =
    pick(profile, "data.user.biography", "user.biography", "biography", "data.biography") ?? "";
  const fullName = pick(profile, "data.user.full_name", "user.full_name", "full_name") ?? "";

  const postsRes = await api("/v2/instagram/user/posts", { handle, trim: true });
  const posts = postsOf(postsRes);
  const captions = posts
    .map((p) => captionHook(captionOf(p)))
    .filter((c) => c.length > 25)
    .slice(0, 10);

  // Comments come from the most-discussed posts, not the most recent — that's
  // where people describe their own problem rather than just reacting.
  const ranked = [...posts]
    .filter((p) => shortcodeOf(p))
    .sort((a, b) => commentCountOf(b) - commentCountOf(a))
    .slice(0, postsForComments);

  const rawComments: any[] = [];
  for (const p of ranked) {
    const url = `https://www.instagram.com/p/${shortcodeOf(p)}/`;
    try {
      const res = await api("/v2/instagram/post/comments", { url });
      rawComments.push(...commentsOf(res));
    } catch {
      // ~90% success rate on this endpoint by their own docs — degrade, don't fail
    }
  }

  const comments = usefulComments(rawComments);

  return {
    handle,
    bio: String(bio),
    fullName: String(fullName),
    captions,
    comments,
    raw: { profile, posts: postsRes },
    thin: comments.length < 8,
  };
}
