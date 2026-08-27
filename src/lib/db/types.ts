import type {
  AudienceCard,
  Blueprint,
  QuizAnswers,
  TopicProposal,
} from "../blueprint/types";

export type BuildStatus =
  | "queued"
  | "running"
  | "awaiting_topic"
  | "awaiting_approval"
  | "declined"
  | "failed"
  | "complete";

export type BuildStage =
  | "scrape"
  | "extract"
  | "propose"
  | "knowledge"
  | "quiz"
  | "briefs"
  | "render"
  | "swap_test"
  | "critique"
  | "gate"
  | "publish";

export interface CreatorRow {
  id: string;
  user_id: string;
  handle: string | null;
  display_name: string | null;
  email: string;
  stripe_account_id: string | null;
  stripe_onboarded: boolean;
  created_at: string;
}

export interface BuildRow {
  id: string;
  creator_id: string;
  status: BuildStatus;
  stage: BuildStage | null;
  halted_at: string | null;
  scrape_data: Record<string, unknown> | null;
  audience_card: AudienceCard | null;
  topic_proposals: { proposals: TopicProposal[]; insufficient?: boolean } | null;
  chosen_topic: TopicProposal | null;
  critic_results: Record<string, unknown> | null;
  reject_reason: string | null;
  error: string | null;
  cost_usd: number;
  created_at: string;
  completed_at: string | null;
}

export type BlueprintStatus = "draft" | "complete" | "approved" | "archived";

export interface BlueprintRow {
  id: string;
  creator_id: string;
  build_id: string | null;
  version: number;
  status: BlueprintStatus;
  data: Blueprint;
  approved_at: string | null;
  approved_by: string | null;
  published: boolean;
  price_cents: number;
  created_at: string;
}

export interface SampleRow {
  id: string;
  blueprint_id: string;
  archetype: string;
  archetype_label: string | null;
  sections: Record<string, string>;
  pdf_path: string | null;
  created_at: string;
}

export type OrderStatus = "pending_payment" | "paid" | "generating" | "delivered" | "failed";

export interface OrderRow {
  id: string;
  blueprint_id: string;
  blueprint_version: number;
  buyer_email: string;
  quiz_answers: QuizAnswers;
  resolved_archetype: string | null;
  resolved_signals: Record<string, unknown> | null;
  stripe_payment_intent: string | null;
  amount_cents: number;
  status: OrderStatus;
  created_at: string;
}

export interface OutputRow {
  id: string;
  order_id: string;
  sections: Record<string, string>;
  pdf_path: string | null;
  generation_ms: number | null;
  cost_usd: number | null;
  created_at: string;
}
