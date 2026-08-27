/**
 * Core data contract types, mirroring docs/blueprint-schema.md and the harness.
 * The blueprint is generated once at build time, approved by the creator,
 * then frozen and versioned. Runtime reads it and never modifies it.
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
  segmentation_preview: string[];
  risk: string;
}

export interface TopicProposals {
  proposals: TopicProposal[];
  insufficient?: boolean;
}

export interface KnowledgeSegment {
  id: string;
  label: string;
  prevalence: "high" | "medium" | "low" | string;
  root_cause: string;
  [k: string]: unknown;
}

export interface Mechanism {
  id: string;
  name: string;
  why_it_works: string;
  applies_to_segments?: string[];
  contested?: boolean;
  confidence?: string;
  [k: string]: unknown;
}

export interface KnowledgePack {
  segments: KnowledgeSegment[];
  mechanisms: Mechanism[];
  false_beliefs: { belief: string; correction: string }[];
  glossary: Record<string, string>;
}

export interface QuizOption {
  value: string;
  label: string;
  sub?: string;
  signals?: Record<string, string | number | boolean>;
}

export interface QuizQuestion {
  id: string;
  question: string;
  type: "single" | "multi";
  required?: boolean;
  help?: string;
  drives?: string[];
  modifies?: string[];
  options: QuizOption[];
}

export interface ArchetypeMatchCondition {
  signal: string;
  in?: (string | number | boolean)[];
  equals?: string | number | boolean;
}

export interface ArchetypeRule {
  id: string;
  label: string;
  priority: number;
  archetype_rationale?: string;
  match: { all?: ArchetypeMatchCondition[]; any?: ArchetypeMatchCondition[] };
}

export interface Quiz {
  questions: QuizQuestion[];
  archetype_rules: ArchetypeRule[];
  fallback_archetype: string;
}

export interface SkeletonSection {
  id: string;
  title: string;
  target_words: number;
  conditional?: boolean;
}

export interface ContentBankEntry {
  brief: string;
  must_include: string[];
  must_avoid: string[];
  mechanism_refs?: string[];
  week_theme?: string;
}

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
  block_id?: string;
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
    skeleton: SkeletonSection[];
    content_bank: Record<string, ContentBankEntry>;
    personalization_tokens: string[];
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

export interface ResolvedArchetype {
  archetype: string;
  signals: Record<string, unknown>;
  matched_rules: string[];
}
