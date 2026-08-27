/**
 * Structural validator for blueprints. Ported from validate-blueprint.js —
 * same logic, typed. Deterministic, no model calls.
 *
 * Two gates, not one:
 *   - structural  — runs after stage 4, before the content bank exists
 *   - coverage    — runs after stage 5, proves every (section, archetype) pair is filled
 *
 * Coverage is inferred from status unless forced. A draft blueprint that fails
 * coverage is not broken, it is unfinished.
 */

import type {
  Blueprint,
  QuizAnswers,
  ResolvedArchetype,
  ValidationIssue,
  ValidationResult,
} from "./types";

const MODIFIER_TARGETS = ["constraints", "voice", "safety", "pacing"];

export function validateBlueprint(
  bp: Blueprint,
  opts: { requireCoverage?: boolean } = {}
): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: { path: string; issue: string }[] = [];
  const requireCoverage =
    opts.requireCoverage ?? ["complete", "approved"].includes(bp.status);
  const err = (path: string, msg: string, fix?: string) =>
    errors.push({ path, issue: msg, fix });
  const warn = (path: string, msg: string) => warnings.push({ path, issue: msg });

  const sections = (bp.output?.skeleton ?? []).map((s) => s.id);
  const questions = bp.quiz?.questions ?? [];
  const rules = bp.quiz?.archetype_rules ?? [];
  const bank = bp.output?.content_bank ?? {};

  // --- Rule 1: every question drives at least one real section -------------
  for (const q of questions) {
    const load = (q.drives?.length ?? 0) + (q.modifies?.length ?? 0);
    if (load === 0) {
      err(
        `quiz.questions.${q.id}`,
        "Question drives no output section and modifies nothing.",
        "Delete the question, or declare what its answer changes."
      );
      continue;
    }
    for (const d of q.drives ?? []) {
      if (!sections.includes(d)) {
        err(
          `quiz.questions.${q.id}.drives`,
          `Drives unknown section "${d}".`,
          MODIFIER_TARGETS.includes(d)
            ? `"${d}" is a global modifier, not a section — move it to "modifies".`
            : `Use one of: ${sections.join(", ")}`
        );
      }
    }
    for (const m of q.modifies ?? []) {
      if (!MODIFIER_TARGETS.includes(m)) {
        err(
          `quiz.questions.${q.id}.modifies`,
          `Unknown modifier target "${m}".`,
          `Use one of: ${MODIFIER_TARGETS.join(", ")}`
        );
      }
    }
  }

  // --- Rule 2: every section is driven by at least one question ------------
  const driven = new Set(questions.flatMap((q) => q.drives ?? []));
  for (const s of bp.output?.skeleton ?? []) {
    if (s.conditional) continue; // conditional sections are triggered by safety rules
    if (!driven.has(s.id)) {
      err(
        `output.skeleton.${s.id}`,
        "Section is not driven by any quiz question — it will be identical for every buyer.",
        "Add a question that changes it, or remove the section."
      );
    }
  }

  // --- Rule 3: every archetype is reachable --------------------------------
  const emitted = new Map<string, Set<unknown>>(); // signal -> possible values
  for (const q of questions) {
    for (const o of q.options ?? []) {
      for (const [k, v] of Object.entries(o.signals ?? {})) {
        if (!emitted.has(k)) emitted.set(k, new Set());
        emitted.get(k)!.add(v);
      }
    }
  }

  for (const rule of rules) {
    const conds = rule.match?.all ?? rule.match?.any ?? [];
    if (!conds.length) {
      err(
        `quiz.archetype_rules.${rule.id}`,
        "Rule has no match conditions.",
        "Add at least one signal condition."
      );
      continue;
    }
    for (const c of conds) {
      const possible = emitted.get(c.signal);
      if (!possible) {
        err(
          `quiz.archetype_rules.${rule.id}`,
          `Matches on signal "${c.signal}" which no quiz option emits.`,
          "Add the signal to a quiz option, or drop the condition."
        );
        continue;
      }
      const wanted = c.in ?? (c.equals !== undefined ? [c.equals] : []);
      if (wanted.length && !wanted.some((v) => possible.has(v))) {
        err(
          `quiz.archetype_rules.${rule.id}`,
          `Signal "${c.signal}" can never take ${JSON.stringify(wanted)}.`,
          `Emitted values: ${[...possible].join(", ")}`
        );
      }
    }
  }

  // --- Rule 4: content bank coverage ---------------------------------------
  const archetypeIds = [
    ...rules.map((r) => r.id),
    bp.quiz?.fallback_archetype,
  ].filter(Boolean) as string[];
  const nonConditional = (bp.output?.skeleton ?? []).filter((s) => !s.conditional);

  const missing: string[] = [];
  for (const a of archetypeIds) {
    for (const s of nonConditional) {
      const key = `${s.id}::${a}`;
      if (!bank[key]) missing.push(key);
    }
  }
  if (missing.length) {
    const detail = `${missing.length} of ${archetypeIds.length * nonConditional.length} pairs missing`;
    if (requireCoverage) {
      err(
        "output.content_bank",
        `Incomplete content bank — ${detail}.`,
        `Generate: ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? ", ..." : ""}`
      );
    } else {
      warn("output.content_bank", `Draft blueprint — ${detail}. Not blocking at this stage.`);
    }
  }

  // --- Rule 5: fallback archetype exists and is covered --------------------
  if (!bp.quiz?.fallback_archetype) {
    err(
      "quiz.fallback_archetype",
      "No fallback archetype. Unmatched buyers would receive nothing.",
      "Define a general archetype with full section coverage."
    );
  }

  // --- Rule 6: quiz length --------------------------------------------------
  if (questions.length < 6) {
    err(
      "quiz.questions",
      `Only ${questions.length} questions — archetypes cannot be reliably distinguished.`,
      "Target 6-12."
    );
  }
  if (questions.length > 12) {
    warn(
      "quiz.questions",
      `${questions.length} questions — completion rate drops sharply past 12.`
    );
  }

  // --- Brief quality checks -------------------------------------------------
  for (const [key, entry] of Object.entries(bank)) {
    if (!entry.brief?.trim()) {
      err(`output.content_bank.${key}`, "Empty brief.", "Regenerate this pair.");
    }
    if ((entry.must_include?.length ?? 0) < 2) {
      err(
        `output.content_bank.${key}`,
        "Fewer than 2 must_include points — the writer has too much latitude.",
        "Add concrete, checkable points."
      );
    }
    const isWeek = key.startsWith("week_");
    if (isWeek && !entry.week_theme) {
      warn(`output.content_bank.${key}`, "Week section has no theme.");
    }
    if (!entry.mechanism_refs?.length && !key.startsWith("safety_check")) {
      warn(
        `output.content_bank.${key}`,
        "Cites no mechanism — likely to score low on the mechanism rubric."
      );
    }
  }

  // --- Mechanism reference integrity ---------------------------------------
  const mechIds = new Set((bp.knowledge_pack?.mechanisms ?? []).map((m) => m.id));
  for (const [key, entry] of Object.entries(bank)) {
    for (const ref of entry.mechanism_refs ?? []) {
      if (!mechIds.has(ref)) {
        err(
          `output.content_bank.${key}.mechanism_refs`,
          `Unknown mechanism "${ref}".`,
          "Reference an id from knowledge_pack.mechanisms."
        );
      }
    }
  }

  for (const m of bp.knowledge_pack?.mechanisms ?? []) {
    if (!m.why_it_works?.trim()) {
      err(
        `knowledge_pack.mechanisms.${m.id}`,
        "No why_it_works — this is an instruction, not a mechanism.",
        "State the causal chain, or drop the mechanism."
      );
    }
  }

  // --- Voice / safety ---------------------------------------------------------
  if (!bp.output?.voice?.banned_phrases?.length) {
    warn("output.voice.banned_phrases", "No banned phrases — voice critic has nothing to enforce.");
  }
  if (bp.safety?.domain_risk_tier === "high" && !bp.safety?.disclaimers?.length) {
    err(
      "safety.disclaimers",
      "High-risk domain with no disclaimers.",
      "Add required disclaimers before this blueprint can be approved."
    );
  }
  for (const t of bp.safety?.escalation_triggers ?? []) {
    if (t.block_id && !bank[t.block_id]) {
      err(
        "safety.escalation_triggers",
        `Trigger points at missing block "${t.block_id}".`,
        "Generate the escalation block."
      );
    }
  }

  // --- Freeze integrity ------------------------------------------------------
  if (bp.status === "approved") {
    if (!bp.approved_at || !bp.approved_by) {
      err(
        "status",
        "Marked approved without an approval record.",
        "Approval must be set by the creator gate, never by the pipeline."
      );
    }
    if (!bp.eval?.golden_samples?.length) {
      warn("eval.golden_samples", "Approved with no stored samples — nothing to regression-test against.");
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

/**
 * Resolve an archetype from quiz answers. Highest priority wins; ties broken by
 * declaration order. Returns the fallback when nothing matches.
 */
export function resolveArchetype(bp: Blueprint, answers: QuizAnswers): ResolvedArchetype {
  const signals: Record<string, unknown> = {};
  for (const q of bp.quiz.questions) {
    const given = answers[q.id];
    const chosen = Array.isArray(given) ? given : [given];
    for (const value of chosen) {
      const opt = q.options?.find((o) => o.value === value);
      for (const [k, v] of Object.entries(opt?.signals ?? {})) {
        if (signals[k] === undefined) signals[k] = v;
        else if (Array.isArray(signals[k])) (signals[k] as unknown[]).push(v);
        else signals[k] = [signals[k], v];
      }
    }
  }

  const has = (signal: string, wanted: unknown[]) => {
    const actual = signals[signal];
    if (actual === undefined) return false;
    const list = Array.isArray(actual) ? actual : [actual];
    return wanted.some((w) => list.includes(w));
  };

  const matches = bp.quiz.archetype_rules
    .filter((r) => {
      const conds = r.match.all ?? r.match.any ?? [];
      const test = (c: { signal: string; in?: unknown[]; equals?: unknown }) =>
        has(c.signal, c.in ?? [c.equals]);
      return r.match.all ? conds.every(test) : conds.some(test);
    })
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

  return {
    archetype: matches[0]?.id ?? bp.quiz.fallback_archetype,
    signals,
    matched_rules: matches.map((m) => m.id),
  };
}
