/**
 * Swap test — deterministic, no model. Ported verbatim from harness/pipeline.mjs.
 * Runs before the output critic because it is free and catches the failure
 * that makes an expensive critic pass pointless.
 */

const bigrams = (text: string): Set<string> => {
  const w = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
  const out = new Set<string>();
  for (let i = 0; i < w.length - 1; i++) out.add(w[i] + " " + w[i + 1]);
  return out;
};

/** Token-level divergence between two rendered sections, 0-100. */
export function divergence(a: string, b: string): number {
  const A = bigrams(a);
  const B = bigrams(b);
  if (!A.size && !B.size) return 0;
  let shared = 0;
  for (const g of A) if (B.has(g)) shared++;
  const union = A.size + B.size - shared;
  return Math.round((1 - shared / union) * 100);
}

export interface SwapTestResult {
  pass: boolean;
  overall: number;
  results: {
    pair: [string, string];
    avg: number;
    sections: { section: string; pct: number }[];
  }[];
}

export function swapTest(
  renders: Record<string, Record<string, string>>,
  pairs: [string, string][],
  minPct: number
): SwapTestResult {
  const results = pairs.map(([a, b]) => {
    const sections = Object.keys(renders[a] || {}).filter((s) => renders[b]?.[s]);
    const scores = sections.map((s) => ({ section: s, pct: divergence(renders[a][s], renders[b][s]) }));
    const avg = scores.length ? Math.round(scores.reduce((t, s) => t + s.pct, 0) / scores.length) : 0;
    return { pair: [a, b] as [string, string], avg, sections: scores };
  });
  const overall = results.length
    ? Math.round(results.reduce((t, r) => t + r.avg, 0) / results.length)
    : 0;
  return { pass: overall >= minPct, overall, results };
}
