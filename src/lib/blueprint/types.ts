/**
 * Core data contract types, mirroring docs/blueprint-schema.md and the harness.
 * The blueprint is generated once at build time, approved by the creator,
 * then frozen and versioned. Runtime reads it and never modifies it.
 *
 * No segments, no archetypes: personalization happens at runtime from the
 * buyer's full quiz answers, not by routing buyers into pre-built buckets.
 * The blueprint carries a per-product OUTPUT TEMPLATE (section structure +
 * content shapes) and a per-product GENERATION PROMPT; one model call per
 * buyer fills the template.
 */

export interface AudienceCard {
  who: string;
  core_promise: string;
  vocabulary: string[];
  audience_words: string[];
  objections: string[];
  tone_notes: string;
  credibility_basis: string;
  confidence: Record<string, number>;
  evidence?: Record<string, string[]>;
}

export interface TopicProposal {
  topic_title: string;
  promise: string;
  /**
   * Model-chosen plan length. Absent on bonus ideas with no natural time
   * component; older transformation proposals predate this and default to 30.
   */
  duration_days?: number;
  /** The out-of-the-box wild-card idea generated after the main proposals. */
  bonus?: boolean;
  scores: {
    acuteness: number;
    segmentability: number;
    resolvability: number;
    credibility: number;
  };
  why_this_works: string;
  /** Informational only — shown on the ideas page so the creator can judge fit. */
  segmentation_preview: string[];
  risk: string;
}

export interface TopicProposals {
  proposals: TopicProposal[];
  insufficient?: boolean;
}

/**
 * A common root cause in the domain. Pure context for the generation model —
 * nothing routes on these.
 */
export interface RootCause {
  id: string;
  label: string;
  prevalence: "high" | "medium" | "low" | string;
  explanation: string;
  [k: string]: unknown;
}

export interface Mechanism {
  id: string;
  name: string;
  why_it_works: string;
  contested?: boolean;
  confidence?: string;
  [k: string]: unknown;
}

export interface KnowledgePack {
  root_causes: RootCause[];
  mechanisms: Mechanism[];
  false_beliefs: { belief: string; correction: string }[];
  glossary: Record<string, string>;
}

export interface QuizOption {
  value: string;
  label: string;
  sub?: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  type: "single" | "multi";
  required?: boolean;
  help?: string;
  /** Template section ids this question's answer materially changes. */
  informs?: string[];
  options: QuizOption[];
}

export interface Quiz {
  questions: QuizQuestion[];
}

// ─────────────────────────────────────────────────── output template

/** Accents map to the app design system, not to raw colors. */
export type Accent = "zest" | "sage" | "amber" | "rose";

/**
 * The dominant content structure of a template section. Each maps to a fixed
 * JSON shape the generation model must produce (see GeneratedSection) and a
 * fixed renderer component.
 */
export type SectionComponent =
  | "prose"
  | "cards"
  | "timeline"
  | "table"
  | "rhythm"
  | "checklist"
  | "brief";

export interface TemplateSection {
  id: string;
  /** e.g. "Protocol 01 · Nutrition" */
  eyebrow: string;
  title: string;
  /** One-line subtitle under the title. */
  description?: string;
  accent: Accent;
  component: SectionComponent;
  /** Column headers, required when component === "table". */
  table_columns?: string[];
  /**
   * What this section must accomplish and how it must be personalized —
   * consumed by the generation prompt, never shown to the buyer.
   */
  instructions: string;
}

export interface OutputTemplate {
  /** Small product wordmark on the cover, e.g. "MenoProtocol". */
  doc_label: string;
  /** Cover eyebrow, e.g. "Personalized Menopause Management Protocol". */
  cover_label: string;
  /** e.g. "Your symptom fingerprint" — adapted to the product's domain. */
  fingerprint_title: string;
  /** 5-8 product-level axes; each buyer gets their own 0-10 value per axis. */
  fingerprint_axes: string[];
  sections: TemplateSection[];
}

// ─────────────────────────────────────────────── generated output shapes

export interface GeneratedCover {
  /** Document title, e.g. "Your Calm-Walks Plan". */
  title: string;
  /** e.g. "Prepared for someone with a 2-year-old Border Collie that pulls". */
  subtitle: string;
  /** 0-10 per template fingerprint axis, same order. */
  fingerprint: number[];
  /** Up to 4 stat slots, e.g. { value: "Late peri", label: "Stage" }. */
  meta: { value: string; label: string }[];
}

export interface CalloutContent {
  label: string;
  body: string;
}

export interface CardItem {
  kicker?: string;
  title: string;
  body: string;
  tag?: string;
}

export interface TimelineItem {
  marker: string;
  range: string;
  title: string;
  body: string;
}

export interface TableRow {
  cells: string[];
  badge?: "high" | "medium" | "low";
}

export interface RhythmItem {
  time: string;
  title: string;
  desc: string;
}

export interface ChecklistGroup {
  label: string;
  items: string[];
}

export interface BriefContent {
  title: string;
  groups: { label: string; items: string[] }[];
}

/**
 * One generated section. `callout` and `intro` are common to every component;
 * exactly one structural field matches the section's declared component.
 */
export interface GeneratedSection {
  /** Personalized "your situation" callout that opens the section. */
  callout?: CalloutContent;
  /** Body paragraphs. */
  intro?: string[];
  cards?: CardItem[];
  timeline?: TimelineItem[];
  table?: { rows: TableRow[] };
  rhythm?: RhythmItem[];
  checklist?: ChecklistGroup[];
  brief?: BriefContent;
  /** Closing paragraph. */
  outro?: string;
}

export interface GeneratedOutput {
  cover: GeneratedCover;
  sections: Record<string, GeneratedSection>;
}

// ────────────────────────────────────────────────────── build-time review

/** A synthetic buyer invented at build time so the creator can review real outputs. */
export interface SampleBuyer {
  /** Short human label, e.g. "First-dog owner, 10 min/day". */
  label: string;
  /** One-line persona description. */
  summary: string;
  answers: QuizAnswers;
}

// ─────────────────────────────────────────────────────────── blueprint

export interface Voice {
  reading_level?: string;
  person?: string;
  banned_phrases?: string[];
  sentence_rhythm?: string;
  tone_notes?: string;
}

export interface RubricDimension {
  id: string;
  weight: number;
  fail_below: number;
  test?: string;
}

export interface EscalationTrigger {
  signal: string;
  equals?: string | number | boolean;
  action?: string;
}

export interface Safety {
  domain_risk_tier: "low" | "medium" | "high" | string;
  disclaimers: string[];
  banned_claims: string[];
  escalation_triggers: EscalationTrigger[];
}

export interface Blueprint {
  blueprint_id: string;
  blueprint_version: number;
  archetype_version?: string;
  status: "draft" | "complete" | "approved" | "archived" | string;
  created_at?: string;
  approved_at?: string;
  approved_by?: string;
  supersedes?: string;
  creator: {
    handle: string;
    display_name?: string;
    credibility_statement?: string;
    audience_card: AudienceCard;
  };
  product: {
    topic_title: string;
    promise: string;
    /** Absent for non-time-boxed products (bonus ideas). */
    duration_days?: number;
    phase_length_days?: number;
    price_usd: number;
    format?: string;
  };
  knowledge_pack: KnowledgePack;
  quiz: Quiz;
  output: {
    template: OutputTemplate;
    /**
     * Product-specific generation rules written at build time. Wrapped with
     * the buyer's answers by composeGenerationPrompt at runtime.
     */
    generation_prompt: string;
    voice: Voice;
    constraints?: Record<string, unknown>;
  };
  safety: Safety;
  eval: {
    rubric: RubricDimension[];
    swap_test?: { persona_pairs?: number; min_divergence_pct: number };
    thresholds?: { min_weighted_score: number; max_regeneration_attempts?: number };
    golden_samples?: string[];
  };
}

export type QuizAnswers = Record<string, string | string[]>;

export interface CreatorInput {
  id?: string;
  handle: string;
  bio: string;
  captions: string[];
  comments: string[];
  self_description: string;
}

export interface CriticResult {
  pass: boolean;
  score: number;
  failures: { path: string; issue: string; fix?: string }[];
}

export interface OutputCriticResult {
  pass: boolean;
  weighted: number;
  scores: Record<string, { score: number; why: string; evidence: string }>;
  failures: unknown[];
}

export interface ValidationIssue {
  path: string;
  issue: string;
  fix?: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: ValidationIssue[];
  warnings: { path: string; issue: string }[];
}
