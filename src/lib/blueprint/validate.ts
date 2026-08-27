/**
 * Structural validators. Deterministic, no model calls.
 *
 * Two contracts, two gates:
 *   - validateBlueprint       — the frozen product: template, quiz, prompt
 *   - validateGeneratedOutput — one buyer's generated document against the
 *     product's template, run on every generation (build samples and runtime)
 */

import type {
  Blueprint,
  GeneratedOutput,
  GeneratedSection,
  OutputTemplate,
  SectionComponent,
  TemplateSection,
  ValidationIssue,
  ValidationResult,
} from "./types";

const COMPONENTS: SectionComponent[] = [
  "prose",
  "cards",
  "timeline",
  "table",
  "rhythm",
  "checklist",
  "brief",
];

export function validateBlueprint(bp: Blueprint): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: { path: string; issue: string }[] = [];
  const err = (path: string, msg: string, fix?: string) =>
    errors.push({ path, issue: msg, fix });
  const warn = (path: string, msg: string) => warnings.push({ path, issue: msg });

  const template = bp.output?.template;
  const sections = template?.sections ?? [];
  const sectionIds = sections.map((s) => s.id);
  const questions = bp.quiz?.questions ?? [];

  // --- Rule 1: the output template is complete -----------------------------
  if (!template) {
    err("output.template", "No output template.", "The build must produce one.");
  } else {
    if (!template.doc_label?.trim()) err("output.template.doc_label", "Missing doc_label.");
    if (!template.cover_label?.trim()) err("output.template.cover_label", "Missing cover_label.");
    if (!template.fingerprint_title?.trim())
      err("output.template.fingerprint_title", "Missing fingerprint_title.");
    const axes = template.fingerprint_axes ?? [];
    if (axes.length < 4 || axes.length > 10) {
      err(
        "output.template.fingerprint_axes",
        `${axes.length} fingerprint axes — need 4-10 to read as a profile.`,
        "Target 5-8 axes the quiz can actually measure."
      );
    }
    if (sections.length < 4) {
      err(
        "output.template.sections",
        `Only ${sections.length} sections — too thin to justify the price.`,
        "Target 5-8 sections."
      );
    }
    const seen = new Set<string>();
    for (const s of sections) {
      const path = `output.template.sections.${s.id}`;
      if (seen.has(s.id)) err(path, "Duplicate section id.");
      seen.add(s.id);
      if (!s.title?.trim()) err(path, "Missing title.");
      if (!s.eyebrow?.trim()) err(path, "Missing eyebrow.");
      if (!s.instructions?.trim()) {
        err(path, "No instructions — the generation model would have to guess.", "State what this section must accomplish and how it personalizes.");
      }
      if (!COMPONENTS.includes(s.component)) {
        err(path, `Unknown component "${s.component}".`, `Use one of: ${COMPONENTS.join(", ")}`);
      }
      if (s.component === "table") {
        const cols = s.table_columns ?? [];
        if (cols.length < 2 || cols.length > 6) {
          err(`${path}.table_columns`, `Table needs 2-6 columns, got ${cols.length}.`);
        }
      }
    }
  }

  // --- Rule 2: generation prompt exists and has substance ------------------
  const genPrompt = bp.output?.generation_prompt ?? "";
  if (genPrompt.trim().length < 200) {
    err(
      "output.generation_prompt",
      "Generation prompt missing or too thin to constrain the writer.",
      "It must carry the product-specific rules — specificity tests, personalization requirements, safety constraints."
    );
  }

  // --- Rule 3: every question changes the output ---------------------------
  for (const q of questions) {
    const informs = q.informs ?? [];
    if (informs.length === 0) {
      err(
        `quiz.questions.${q.id}`,
        "Question informs no template section — its answer would change nothing.",
        "Delete the question, or declare which sections its answer changes."
      );
      continue;
    }
    for (const id of informs) {
      if (!sectionIds.includes(id)) {
        err(
          `quiz.questions.${q.id}.informs`,
          `Informs unknown section "${id}".`,
          `Use one of: ${sectionIds.join(", ")}`
        );
      }
    }
    if ((q.options?.length ?? 0) < 2) {
      err(`quiz.questions.${q.id}.options`, "Fewer than 2 options.");
    }
  }

  // --- Rule 4: every section is informed by at least one question ----------
  const informed = new Set(questions.flatMap((q) => q.informs ?? []));
  for (const s of sections) {
    if (!informed.has(s.id)) {
      warn(
        `output.template.sections.${s.id}`,
        "No quiz question informs this section — it will lean on the overall profile only."
      );
    }
  }

  // --- Rule 5: quiz length --------------------------------------------------
  if (questions.length < 6) {
    err(
      "quiz.questions",
      `Only ${questions.length} questions — not enough signal to personalize honestly.`,
      "Target 6-12."
    );
  }
  if (questions.length > 12) {
    warn(
      "quiz.questions",
      `${questions.length} questions — completion rate drops sharply past 12.`
    );
  }

  // --- Mechanism quality -----------------------------------------------------
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

  // --- Freeze integrity ------------------------------------------------------
  if (bp.status === "approved") {
    if (!bp.approved_at || !bp.approved_by) {
      err(
        "status",
        "Marked approved without an approval record.",
        "Approval must be set by the creator gate, never by the pipeline."
      );
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

// ─────────────────────────────────────────── generated output validation

function structuralField(section: TemplateSection, gen: GeneratedSection): boolean {
  switch (section.component) {
    case "prose":
      return (gen.intro?.length ?? 0) > 0;
    case "cards":
      return (gen.cards?.length ?? 0) >= 2 && gen.cards!.every((c) => c.title && c.body);
    case "timeline":
      return (
        (gen.timeline?.length ?? 0) >= 2 && gen.timeline!.every((t) => t.title && t.body)
      );
    case "table": {
      const rows = gen.table?.rows ?? [];
      const width = section.table_columns?.length ?? 0;
      return rows.length >= 2 && rows.every((r) => (r.cells?.length ?? 0) === width);
    }
    case "rhythm":
      return (gen.rhythm?.length ?? 0) >= 3 && gen.rhythm!.every((r) => r.time && r.title);
    case "checklist":
      return (
        (gen.checklist?.length ?? 0) >= 1 &&
        gen.checklist!.every((g) => g.label && (g.items?.length ?? 0) >= 2)
      );
    case "brief":
      return (
        Boolean(gen.brief?.title) &&
        (gen.brief?.groups?.length ?? 0) >= 2 &&
        gen.brief!.groups.every((g) => g.label && (g.items?.length ?? 0) >= 1)
      );
  }
}

/** Structural check of one buyer's generated document against the template. */
export function validateGeneratedOutput(
  template: OutputTemplate,
  output: GeneratedOutput
): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: { path: string; issue: string }[] = [];
  const err = (path: string, msg: string, fix?: string) =>
    errors.push({ path, issue: msg, fix });

  const cover = output?.cover;
  if (!cover?.title?.trim()) err("cover.title", "Missing cover title.");
  if (!cover?.subtitle?.trim()) err("cover.subtitle", "Missing cover subtitle.");
  const axes = template.fingerprint_axes ?? [];
  const fp = cover?.fingerprint ?? [];
  if (fp.length !== axes.length) {
    err(
      "cover.fingerprint",
      `${fp.length} fingerprint values for ${axes.length} axes.`,
      "Return one 0-10 value per axis, in axis order."
    );
  } else if (fp.some((v) => typeof v !== "number" || v < 0 || v > 10)) {
    err("cover.fingerprint", "Fingerprint values must be numbers 0-10.");
  }

  const genSections = output?.sections ?? {};
  for (const section of template.sections) {
    const gen = genSections[section.id];
    if (!gen) {
      err(`sections.${section.id}`, "Section missing from the generated output.");
      continue;
    }
    if (!structuralField(section, gen)) {
      err(
        `sections.${section.id}`,
        `Section content does not satisfy its "${section.component}" shape.`,
        "Regenerate with the declared structure and minimum item counts."
      );
    }
    if (section.component !== "prose" && !gen.callout?.body) {
      warnings.push({
        path: `sections.${section.id}.callout`,
        issue: "No personalized opening callout.",
      });
    }
  }
  for (const id of Object.keys(genSections)) {
    if (!template.sections.some((s) => s.id === id)) {
      warnings.push({ path: `sections.${id}`, issue: "Unknown section — will not render." });
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

/**
 * Flatten a generated document to plain text per section — feeds the swap
 * divergence test and the output critic.
 */
export function flattenGeneratedOutput(
  template: OutputTemplate,
  output: GeneratedOutput
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const section of template.sections) {
    const gen = output.sections?.[section.id];
    if (!gen) continue;
    const parts: string[] = [];
    if (gen.callout) parts.push(gen.callout.label, gen.callout.body);
    for (const p of gen.intro ?? []) parts.push(p);
    for (const c of gen.cards ?? []) parts.push(c.kicker ?? "", c.title, c.body, c.tag ?? "");
    for (const t of gen.timeline ?? []) parts.push(t.range, t.title, t.body);
    for (const r of gen.table?.rows ?? []) parts.push(...r.cells);
    for (const r of gen.rhythm ?? []) parts.push(r.time, r.title, r.desc);
    for (const g of gen.checklist ?? []) parts.push(g.label, ...g.items);
    if (gen.brief) {
      parts.push(gen.brief.title);
      for (const g of gen.brief.groups) parts.push(g.label, ...g.items);
    }
    if (gen.outro) parts.push(gen.outro);
    out[section.id] = parts.filter(Boolean).join("\n");
  }
  return out;
}
