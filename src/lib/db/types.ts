import type {
  AudienceCard,
  Blueprint,
  GeneratedOutput,
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
  | "template"
  | "prompt"
  | "quiz"
  | "samples"
  | "swap_test"
  | "critique"
  | "gate"
  | "publish";

/** Launch checklist state: item id → ISO timestamp when completed. */
export type LaunchChecklist = Partial<Record<"quiz" | "link" | "bio" | "story", string>>;

export interface CreatorRow {
  id: string;
  user_id: string;
  handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
  email: string;
  stripe_account_id: string | null;
  stripe_onboarded: boolean;
  /** Activation moment: set once on the creator's first paid order. */
  first_sale_at: string | null;
  launch_checklist: LaunchChecklist;
  created_at: string;
}

export interface BuildRow {
  id: string;
  /** Null while the build belongs to an anonymous visitor (guest build). */
  creator_id: string | null;
  /** Cookie-held ownership token for pre-signup builds; nulled at claim. */
  guest_token: string | null;
  /** The Instagram handle a guest entered; copied to creators.handle at claim. */
  handle: string | null;
  /** Idea picked right before the signup redirect, resumed at claim time. */
  pending_topic_index: number | null;
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

/** Paste-ready promotion copy generated at publish time. */
export interface ShareKit {
  bio_line: string;
  story_text: string;
  caption: string;
  reel_script: string;
}

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
  share_kit: ShareKit | null;
  created_at: string;
}

export interface SampleRow {
  id: string;
  blueprint_id: string;
  persona: string;
  persona_label: string | null;
  /** The full generated document for this synthetic buyer. */
  sections: GeneratedOutput;
  created_at: string;
}

export type OrderStatus = "pending_payment" | "paid" | "generating" | "delivered" | "failed";

export interface OrderRow {
  id: string;
  blueprint_id: string;
  blueprint_version: number;
  buyer_email: string;
  quiz_answers: QuizAnswers;
  stripe_payment_intent: string | null;
  amount_cents: number;
  status: OrderStatus;
  created_at: string;
}

export type QuizSessionStatus = "quiz_started" | "quiz_completed" | "checkout" | "paid";

/** One visitor quiz attempt, tracked from first answer through payment. */
export interface QuizSessionRow {
  id: string;
  blueprint_id: string;
  creator_id: string;
  status: QuizSessionStatus;
  answers: QuizAnswers;
  last_question_idx: number;
  questions_total: number;
  email: string | null;
  order_id: string | null;
  abandoned_email_sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export type CreatorEventType = "page_visit" | "link_copied";

/** Creator-side funnel event (public-page visits, share-link copies). */
export interface CreatorEventRow {
  id: string;
  creator_id: string;
  blueprint_id: string | null;
  type: CreatorEventType;
  meta: Record<string, unknown> | null;
  created_at: string;
}

export interface OutputRow {
  id: string;
  order_id: string;
  /** The buyer's full generated document. */
  sections: GeneratedOutput;
  generation_ms: number | null;
  cost_usd: number | null;
  created_at: string;
}
