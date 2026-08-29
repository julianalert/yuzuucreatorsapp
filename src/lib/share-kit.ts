import "server-only";
import { ask, type Usage } from "./pipeline/ask";
import { CREATOR_KEEP_PCT } from "./seo";
import type { AudienceCard } from "./blueprint/types";
import type { ShareKit } from "./db/types";

export type { ShareKit } from "./db/types";

export interface ShareKitInput {
  handle: string;
  topicTitle: string;
  promise: string;
  priceCents: number;
  durationDays?: number;
  audienceCard?: AudienceCard;
}

function productUrl(handle: string): string {
  return `yuzuu.co/u/${handle}`;
}

export function netPerSaleUsd(priceCents: number): number {
  return Math.round((priceCents * CREATOR_KEEP_PCT) / 100) / 100;
}

/**
 * Always-available kit written from the product's own words. Used when the
 * model call is unavailable (mock mode, missing key) or fails — the launch
 * screen must never be empty.
 */
export function fallbackShareKit(input: ShareKitInput): ShareKit {
  const url = productUrl(input.handle);
  const price = (input.priceCents / 100).toFixed(0);
  const duration = input.durationDays ? `${input.durationDays}-day ` : "";
  return {
    bio_line: `${input.topicTitle} — personalized to you in a 2-min quiz → ${url}`,
    story_text:
      `I made something for you: ${input.topicTitle}.\n\n` +
      `${input.promise}\n\n` +
      `You answer a short quiz and get a ${duration}plan written for your exact situation — not a template. $${price}, link in bio or swipe up → ${url}`,
    caption:
      `New: ${input.topicTitle}.\n\n` +
      `${input.promise}\n\n` +
      `It starts with a 2-minute quiz about your situation, then a plan gets written for you personally. Two people with different situations get genuinely different plans.\n\n` +
      `$${price}, one time. Link in bio → ${url}`,
    reel_script:
      `Hook (2s): "I built something I wish existed when I started."\n` +
      `Problem (5s): name the exact struggle your audience keeps commenting about.\n` +
      `What it is (8s): "${input.topicTitle} — you take a 2-minute quiz and get a plan written for your exact situation."\n` +
      `Proof (5s): show the quiz and a plan on screen.\n` +
      `CTA (3s): "Link in bio — ${url}"`,
  };
}

function isValidKit(kit: unknown): kit is ShareKit {
  if (!kit || typeof kit !== "object") return false;
  const k = kit as Record<string, unknown>;
  return (["bio_line", "story_text", "caption", "reel_script"] as const).every(
    (f) => typeof k[f] === "string" && (k[f] as string).trim().length > 0
  );
}

/**
 * Write the share kit in the creator's own audience's language. Non-fatal by
 * design: any failure returns the deterministic fallback.
 */
export async function generateShareKit(input: ShareKitInput, usage?: Usage): Promise<ShareKit> {
  if (process.env.PIPELINE_MOCK === "true") return fallbackShareKit(input);
  try {
    const url = productUrl(input.handle);
    const price = (input.priceCents / 100).toFixed(0);
    const kit = await ask(
      "build",
      `Write ready-to-paste Instagram promotion copy for a creator announcing their new digital product. The creator will paste these verbatim — no placeholders, no [brackets], no hashtag spam.

<product>
title: ${input.topicTitle}
promise: ${input.promise}
price: $${price} one-time${input.durationDays ? `\nduration: ${input.durationDays} days` : ""}
url: ${url}
how it works: the buyer takes a ~2 minute quiz about their exact situation, then a plan is written for them personally — different buyers get materially different plans.
</product>
${input.audienceCard ? `<audience_card>${JSON.stringify(input.audienceCard)}</audience_card>\n\nWrite in the creator's voice using tone_notes, and use the audience's own words from audience_words — not marketing language.` : ""}

Rules:
- Never oversell. State what it is, who it's for, and that it's personalized.
- The bio_line must fit in an Instagram bio: under 120 characters including the URL.
- The story_text is one story slide: short lines, under 280 characters, ends with the URL.
- The caption is a feed post: 3-6 short paragraphs, ends with "Link in bio" and the URL.
- The reel_script is a 20-30 second talking-head script with timed beats (Hook / Problem / What it is / CTA).
- No emojis unless the audience_card tone clearly uses them. No "game-changer", "unlock", "journey".

Return JSON only:
{"bio_line":"...","story_text":"...","caption":"...","reel_script":"..."}`,
      { maxTokens: 1500, usage }
    );
    if (isValidKit(kit)) return kit;
    return fallbackShareKit(input);
  } catch (e) {
    console.error("[share-kit] generation failed, using fallback:", e);
    return fallbackShareKit(input);
  }
}
