#!/usr/bin/env node
/**
 * Turn real creator profiles into harness input.
 *
 * Manual path (recommended for the first run):
 *   1. cp inbox/_template.md inbox/somehandle.md
 *   2. paste bio, captions, comments
 *   3. node ingest.mjs
 *   → writes creators.real.json
 *
 * Scraper path — see scrape.mjs (ScrapeCreators):
 *   export SCRAPECREATORS_API_KEY=...
 *   node scrape.mjs handle1 handle2
 *   → writes inbox/*.md, then run ingest.mjs
 *
 * Then:
 *   node run.mjs --input creators.real.json
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const INBOX = path.join(HERE, "inbox");
const OUT = path.join(HERE, "creators.real.json");

const argv = process.argv.slice(2);

// ------------------------------------------------------------ markdown parse

/** Sections are `## name`, bullet lists become arrays, prose stays a string. */
function parseCreatorMd(text, filename) {
  const id = path.basename(filename, ".md");
  const sections = {};
  let key = null;
  let buf = [];

  const flush = () => {
    if (!key) return;
    const lines = buf.map((l) => l.trim()).filter(Boolean);
    const bullets = lines.filter((l) => l.startsWith("- ")).map((l) => l.slice(2).trim());
    sections[key] = bullets.length ? bullets : lines.join(" ").trim();
    buf = [];
  };

  for (const line of text.split("\n")) {
    const m = line.match(/^##\s+(.+)$/);
    if (m) {
      flush();
      key = m[1].trim().toLowerCase().replace(/\s+/g, "_");
    } else if (key) {
      buf.push(line);
    }
  }
  flush();

  return {
    id,
    handle: sections.handle || id,
    niche_note: sections.expectation || "",
    bio: sections.bio || "",
    captions: toArray(sections.captions),
    comments: toArray(sections.comments),
    self_description: sections.self_description || sections.what_they_help_with || "",
  };
}

const toArray = (v) => (Array.isArray(v) ? v : v ? [v] : []);

function checkCreator(c) {
  const problems = [];
  if (!c.bio) problems.push("no bio");
  if (c.captions.length < 4) problems.push(`only ${c.captions.length} captions (want 5-10)`);
  if (c.comments.length < 5) problems.push(`only ${c.comments.length} comments (want 10-20) — this is the highest-value input`);
  if (!c.self_description) problems.push("no self_description");
  return problems;
}

// -------------------------------------------------------------------- main

fs.mkdirSync(INBOX, { recursive: true });

const files = fs.readdirSync(INBOX).filter((f) => f.endsWith(".md") && !f.startsWith("_"));
if (!files.length) {
  console.log(`\nNo creator files in ${INBOX}.\n\n  cp inbox/_template.md inbox/yourhandle.md\n`);
  process.exit(1);
}

const creators = [];
let blocked = 0;

for (const f of files) {
  const c = parseCreatorMd(fs.readFileSync(path.join(INBOX, f), "utf8"), f);
  const problems = checkCreator(c);
  const hasTodo = JSON.stringify(c).includes("TODO");

  if (hasTodo) {
    console.log(`  ✗ ${c.id} — still has TODOs, skipping`);
    blocked++;
    continue;
  }
  if (problems.length) {
    console.log(`  ⚠ ${c.id} — ${problems.join("; ")}`);
  } else {
    console.log(`  ✓ ${c.id} — ${c.captions.length} captions, ${c.comments.length} comments`);
  }
  creators.push(c);
}

if (!creators.length) {
  console.log("\nNothing usable yet.\n");
  process.exit(1);
}

fs.writeFileSync(OUT, JSON.stringify(creators, null, 2));
console.log(`\n${creators.length} creators → creators.real.json${blocked ? ` (${blocked} skipped)` : ""}`);
console.log(`\n  node run.mjs --input creators.real.json --only ${creators[0].id}   # start with one\n`);
