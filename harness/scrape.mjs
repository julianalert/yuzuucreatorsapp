#!/usr/bin/env node
/**
 * Fill the inbox from ScrapeCreators.
 *
 *   export SCRAPECREATORS_API_KEY=...
 *   node scrape.mjs handle1 handle2 handle3
 *   node scrape.mjs --file handles.txt
 *   node scrape.mjs handle1 --inspect        # dump raw JSON, confirm field shapes
 *   node scrape.mjs handle1 --posts 3        # fewer comment calls
 *
 * Then: node ingest.mjs && node run.mjs --input creators.real.json
 *
 * Endpoints used (verified 2026-08-25):
 *   GET /v1/instagram/profile?handle=
 *   GET /v2/instagram/user/posts?handle=&trim=true
 *   GET /v2/instagram/post/comments?url=
 *
 * Cost: roughly 2 + N credits per creator (N = posts we pull comments from).
 * At the default 4 posts that's ~6 credits each, so ten creators fits inside
 * the 100 free credits. Raw responses are cached to .cache/ — re-running to
 * re-tune the filters costs nothing.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const INBOX = path.join(HERE, "inbox");
const CACHE = path.join(HERE, ".cache");
const BASE = "https://api.scrapecreators.com";

const argv = process.argv.slice(2);
const has = (f) => argv.includes(`--${f}`);
const val = (f, d) => (has(f) ? argv[argv.indexOf(`--${f}`) + 1] : d);

const INSPECT = has("inspect");
const POSTS_FOR_COMMENTS = Number(val("posts", 4));
const FORCE = has("force");

let handles = argv.filter((a) => !a.startsWith("--"));
// drop values that belong to flags
for (const f of ["posts", "file"]) {
  if (has(f)) handles = handles.filter((h) => h !== val(f));
}
if (has("file")) {
  handles = fs.readFileSync(path.join(HERE, val("file")), "utf8")
    .split("\n").map((l) => l.trim().replace(/^@/, "")).filter((l) => l && !l.startsWith("#"));
}

if (!handles.length) {
  console.error(`\nUsage: node scrape.mjs handle1 handle2 ...\n       node scrape.mjs --file handles.txt\n`);
  process.exit(1);
}

const KEY = process.env.SCRAPECREATORS_API_KEY;
if (!KEY) {
  console.error("\nSCRAPECREATORS_API_KEY not set.\n");
  process.exit(1);
}

fs.mkdirSync(INBOX, { recursive: true });
fs.mkdirSync(CACHE, { recursive: true });

let credits = 0;

async function api(endpoint, params) {
  const url = new URL(BASE + endpoint);
  for (const [k, v] of Object.entries(params)) if (v != null) url.searchParams.set(k, String(v));

  const cacheKey = crypto.createHash("sha1").update(url.toString()).digest("hex").slice(0, 16);
  const cacheFile = path.join(CACHE, `${cacheKey}.json`);
  if (!FORCE && fs.existsSync(cacheFile)) {
    return JSON.parse(fs.readFileSync(cacheFile, "utf8"));
  }

  const res = await fetch(url, { headers: { "x-api-key": KEY } });
  credits++;
  if (!res.ok) throw new Error(`${endpoint} → ${res.status} ${await res.text().catch(() => "")}`);
  const data = await res.json();
  fs.writeFileSync(cacheFile, JSON.stringify(data, null, 2));
  return data;
}

// ------------------------------------------------------------ field probing
/**
 * Response shapes are not contractually stable — probe several plausible paths
 * rather than hardcoding one. Run with --inspect to see the real shape and
 * tighten these if anything comes back empty.
 */
const pick = (obj, ...paths) => {
  for (const p of paths) {
    const v = p.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);
    if (v != null && v !== "") return v;
  }
  return undefined;
};

const postsOf = (r) => pick(r, "items", "data.items", "posts", "data") ?? [];
const captionOf = (p) => pick(p, "caption.text", "caption", "edge_media_to_caption.edges.0.node.text", "text") ?? "";
const commentCountOf = (p) => Number(pick(p, "comment_count", "comments_count", "edge_media_to_comment.count") ?? 0);
const shortcodeOf = (p) => pick(p, "code", "shortcode", "id");
const commentsOf = (r) => pick(r, "comments", "data.comments", "items", "data.items") ?? [];
const commentTextOf = (c) => pick(c, "text", "comment.text", "node.text") ?? "";

// ------------------------------------------------------------- filtering

/** First line of a caption, which is where creators state their position. */
function captionHook(text) {
  const line = String(text).split("\n").map((l) => l.trim()).find((l) => l.length > 25);
  return (line ?? "").replace(/\s+#\w+/g, "").replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "").trim();
}

const PRAISE = /^(love|amazing|yes+|this|so good|great|thank you|thanks|beautiful|perfect|wow|omg|❤|🔥|👏|😍)/i;

/**
 * Keep comments where someone describes their own problem. Those are the ones
 * stage 1 actually uses; praise and tags are noise that dilutes the prompt.
 */
function usefulComments(raw) {
  const seen = new Set();
  return raw
    .map((c) => commentTextOf(c).replace(/\s+/g, " ").trim())
    .filter((t) => {
      if (t.length < 25 || t.length > 400) return false;
      if (/^@/.test(t)) return false;                       // pure tag
      if ((t.match(/@\w+/g) ?? []).length > 1) return false; // tag chain
      if (PRAISE.test(t) && t.length < 60) return false;     // short praise
      if (!/[a-z]{3}/i.test(t)) return false;                // emoji only
      const key = t.toLowerCase().slice(0, 40);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((t) => ({
      text: t,
      // first-person problem language is the signal we actually want
      score: (/\b(i|i'm|im|my|me|we)\b/i.test(t) ? 2 : 0) +
             (/\?/.test(t) ? 2 : 0) +
             (/\b(how|why|what|should|can'?t|won'?t|always|never|keep|still|tried)\b/i.test(t) ? 1 : 0),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 20)
    .map((c) => c.text);
}

// ------------------------------------------------------------------ main

const summary = [];

for (const handle of handles) {
  const clean = handle.replace(/^@/, "").trim();
  const outFile = path.join(INBOX, `${clean}.md`);
  if (fs.existsSync(outFile) && !FORCE) {
    console.log(`  skip ${clean} — inbox/${clean}.md exists (--force to overwrite)`);
    continue;
  }

  process.stdout.write(`  ${clean} `);
  try {
    const profile = await api("/v1/instagram/profile", { handle: clean });
    if (INSPECT) {
      console.log("\n--- profile ---\n" + JSON.stringify(profile, null, 2).slice(0, 3000));
    }

    const bio = pick(profile, "data.user.biography", "user.biography", "biography", "data.biography") ?? "";
    const fullName = pick(profile, "data.user.full_name", "user.full_name", "full_name") ?? "";

    const postsRes = await api("/v2/instagram/user/posts", { handle: clean, trim: true });
    if (INSPECT) {
      console.log("\n--- posts ---\n" + JSON.stringify(postsRes, null, 2).slice(0, 3000));
    }

    const posts = postsOf(postsRes);
    const captions = posts.map((p) => captionHook(captionOf(p))).filter((c) => c.length > 25).slice(0, 10);

    // Comments come from the most-discussed posts, not the most recent — that's
    // where people describe their own problem rather than just reacting.
    const ranked = [...posts]
      .filter((p) => shortcodeOf(p))
      .sort((a, b) => commentCountOf(b) - commentCountOf(a))
      .slice(0, POSTS_FOR_COMMENTS);

    let comments = [];
    for (const p of ranked) {
      const url = `https://www.instagram.com/p/${shortcodeOf(p)}/`;
      try {
        const res = await api("/v2/instagram/post/comments", { url });
        if (INSPECT) console.log("\n--- comments ---\n" + JSON.stringify(res, null, 2).slice(0, 2000));
        comments.push(...commentsOf(res));
      } catch (e) {
        // ~90% success rate on this endpoint by their own docs — degrade, don't fail
        process.stdout.write("!");
      }
    }

    const picked = usefulComments(comments);

    fs.writeFileSync(outFile, `## handle
${clean}

## bio
${String(bio).replace(/\n/g, " ").trim() || "TODO — profile returned no bio"}

## self_description
TODO — one sentence: who they help, with what.${fullName ? ` (profile name: ${fullName})` : ""}

## captions
${captions.length ? captions.map((c) => "- " + c).join("\n") : "- TODO — no captions returned"}

## comments
${picked.length ? picked.map((c) => "- " + c).join("\n") : "- TODO — no usable comments returned"}

## expectation
TODO — your prediction, one line, written BEFORE you run the pipeline.
`);

    summary.push({ handle: clean, captions: captions.length, comments: picked.length });
    console.log(`✓ ${captions.length} captions, ${picked.length} comments`);
  } catch (e) {
    console.log(`✗ ${e.message}`);
    summary.push({ handle: clean, error: e.message });
  }
}

console.log(`\n${credits} API calls (cached results were free)\n`);

const thin = summary.filter((s) => !s.error && s.comments < 8);
if (thin.length) {
  console.log("Thin on comments — paste more by hand before running:");
  for (const s of thin) console.log(`  ${s.handle} (${s.comments})`);
  console.log();
}

console.log("Every file still has TODOs for self_description and expectation.");
console.log("Fill those in, then: node ingest.mjs\n");
