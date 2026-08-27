/**
 * Mock stage implementations. Exercises the pipeline plumbing — validation,
 * gating, swap test — without spending money.
 *
 * Deliberately imperfect: sourdough returns no viable topic, language_spanish
 * produces near-identical documents for different buyers so the swap test
 * fires, and budget_debt fails the output critic.
 *
 * A factory (not module state) so tests can run concurrently.
 */

import type {
  AudienceCard,
  CreatorInput,
  CriticResult,
  GeneratedOutput,
  KnowledgePack,
  OutputCriticResult,
  OutputTemplate,
  Quiz,
  RubricDimension,
  Safety,
  SampleBuyer,
  TopicProposal,
  TopicProposals,
  Voice,
} from "../blueprint/types";
import type { GenerateOutputArgs } from "./stages";

export type { GenerateOutputArgs } from "./stages";

export interface PipelineApi {
  extractAudience(creator: CreatorInput): Promise<AudienceCard>;
  proposeTopics(audience: AudienceCard): Promise<TopicProposals>;
  proposeBonusTopic(audience: AudienceCard, existing: TopicProposal[]): Promise<TopicProposal>;
  buildKnowledgePack(topic: TopicProposal, audience: AudienceCard): Promise<KnowledgePack>;
  designOutputTemplate(
    topic: TopicProposal,
    pack: KnowledgePack,
    audience: AudienceCard
  ): Promise<OutputTemplate>;
  designQuiz(
    topic: TopicProposal,
    pack: KnowledgePack,
    audience: AudienceCard,
    template: OutputTemplate
  ): Promise<Quiz>;
  writeGenerationPrompt(
    topic: TopicProposal,
    pack: KnowledgePack,
    template: OutputTemplate,
    voice: Voice,
    safety: Safety
  ): Promise<string>;
  inventSampleBuyers(quiz: Quiz, audience: AudienceCard): Promise<SampleBuyer[]>;
  generateOutput(args: GenerateOutputArgs): Promise<GeneratedOutput>;
  knowledgeCritic(pack: KnowledgePack): Promise<CriticResult>;
  quizCritic(
    quiz: Quiz,
    template: OutputTemplate,
    pack: KnowledgePack,
    words: string[]
  ): Promise<CriticResult>;
  outputCritic(
    buyerContext: string,
    documentText: string,
    rubric: RubricDimension[]
  ): Promise<OutputCriticResult>;
  claimsCritic(section: string, domain: string, banned: string[]): Promise<CriticResult>;
}

const MOCK_TEMPLATE: OutputTemplate = {
  doc_label: "Mock Plan",
  cover_label: "Personalized Mock Plan",
  fingerprint_title: "Your situation at a glance",
  fingerprint_axes: ["severity", "time", "history", "context", "pressure"],
  sections: [
    {
      id: "diagnosis",
      eyebrow: "Part 01 · Diagnosis",
      title: "What's actually going on",
      description: "Your situation decoded",
      accent: "rose",
      component: "cards",
      instructions: "Explain the buyer's specific root causes using their stated answers.",
    },
    {
      id: "plan",
      eyebrow: "Part 02 · The plan",
      title: "Your phased plan",
      description: "Step by step",
      accent: "sage",
      component: "timeline",
      instructions: "Phase the work to fit the buyer's stated time budget.",
    },
    {
      id: "reference",
      eyebrow: "Part 03 · Reference",
      title: "Your priority table",
      description: "Ordered for your situation",
      accent: "amber",
      component: "table",
      table_columns: ["Item", "Why", "Priority"],
      instructions: "Prioritize interventions for this buyer's severity and context.",
    },
    {
      id: "daily",
      eyebrow: "Part 04 · Daily",
      title: "Your day, restructured",
      description: "Time-stamped",
      accent: "zest",
      component: "rhythm",
      instructions: "Fit the schedule to the buyer's stated availability.",
    },
    {
      id: "milestones",
      eyebrow: "Part 05 · Milestones",
      title: "How you'll know it's working",
      description: "Measurable gates",
      accent: "sage",
      component: "checklist",
      instructions: "Make milestones measurable against the buyer's starting point.",
    },
  ],
};

export function createMockApi(): PipelineApi {
  let current: CreatorInput | null = null;

  return {
    async extractAudience(creator) {
      current = creator;
      return {
        who: `Audience of ${creator.handle}.`,
        core_promise: creator.self_description,
        vocabulary: ["threshold", "baseline", "consistency"],
        audience_words: creator.comments.slice(0, 3),
        objections: creator.comments.slice(0, 2),
        tone_notes: "Direct, competent, no fluff.",
        credibility_basis: creator.bio,
        confidence: { who: 0.8, core_promise: 0.85, objections: 0.7 },
      };
    },

    async proposeTopics() {
      if (current?.id === "sourdough") return { proposals: [], insufficient: true };
      const seg = current?.id === "language_spanish" ? 6 : 8;
      return {
        proposals: [
          {
            topic_title: `The 21-Day ${current?.handle} Reset`,
            promise: current?.self_description ?? "",
            duration_days: 21,
            scores: { acuteness: 8, segmentability: seg, resolvability: 7, credibility: 9 },
            why_this_works: "mock",
            segmentation_preview: ["a", "b", "c", "d"],
            risk: "mock",
          },
        ],
      };
    },

    async proposeBonusTopic() {
      return {
        topic_title: `The ${current?.handle} Field Guide`,
        promise: "A personalized playbook, not a countdown.",
        scores: { acuteness: 7, segmentability: 8, resolvability: 8, credibility: 8 },
        why_this_works: "mock bonus",
        segmentation_preview: ["a", "b", "c", "d"],
        risk: "mock",
      };
    },

    async buildKnowledgePack() {
      return {
        root_causes: Array.from({ length: 7 }, (_, i) => ({
          id: `rc_${i}`,
          label: `Root cause ${i}`,
          prevalence: "high",
          explanation: `Why root cause ${i} produces the symptom.`,
        })),
        mechanisms: Array.from({ length: 6 }, (_, i) => ({
          id: `mech_${i}`,
          name: `Mechanism ${i}`,
          why_it_works: `Causal chain ${i}.`,
        })),
        false_beliefs: [{ belief: "x", correction: "y" }],
        glossary: { threshold: "the point past which it stops working" },
      };
    },

    async designOutputTemplate() {
      return structuredClone(MOCK_TEMPLATE);
    },

    async designQuiz() {
      const questions = [
        { id: "q_stage", question: "Where are you now?", type: "single" as const, required: true,
          informs: ["diagnosis", "plan"],
          options: [
            { value: "early", label: "Just starting" },
            { value: "stuck", label: "Been stuck a while" },
          ] },
        { id: "q_cause", question: "What's the main obstacle?", type: "single" as const, required: true,
          informs: ["diagnosis", "reference"],
          options: [
            { value: "time", label: "No time" },
            { value: "method", label: "Tried things that failed" },
          ] },
        { id: "q_history", question: "What have you tried?", type: "multi" as const, required: true,
          informs: ["diagnosis", "milestones"],
          options: [
            { value: "nothing", label: "Nothing structured" },
            { value: "lots", label: "Several things" },
          ] },
        { id: "q_budget", question: "How long per day?", type: "single" as const, required: true,
          informs: ["plan", "daily"],
          options: [
            { value: "5", label: "5 minutes" },
            { value: "20", label: "20 minutes" },
          ] },
        { id: "q_context", question: "What's your situation?", type: "single" as const, required: true,
          informs: ["daily", "reference"],
          options: [
            { value: "solo", label: "On my own" },
            { value: "shared", label: "Others involved" },
          ] },
        { id: "q_pressure", question: "Any deadline?", type: "single" as const, required: true,
          informs: ["plan", "milestones"],
          options: [
            { value: "yes", label: "Yes" },
            { value: "no", label: "No" },
          ] },
      ];
      return { questions };
    },

    async writeGenerationPrompt() {
      return [
        "1. Every section must visibly use the buyer's stated answers — quote their situation back to them.",
        "2. Derive the diagnosis from the root causes their answers point to; never list all of them.",
        "3. Every recommendation cites a mechanism from the knowledge pack.",
        "4. The buyer's stated time budget is a hard limit on every step.",
        "5. Calibrate severity to the answers, never default to moderate.",
        "QUALITY CHECKLIST: personalized? mechanisms cited? within time budget? honest? complete?",
      ].join("\n");
    },

    async inventSampleBuyers(quiz) {
      const pick = (chooser: (qIndex: number) => number): Record<string, string | string[]> => {
        const answers: Record<string, string | string[]> = {};
        quiz.questions.forEach((q, i) => {
          const opt = q.options[chooser(i) % q.options.length];
          answers[q.id] = q.type === "multi" ? [opt.value] : opt.value;
        });
        return answers;
      };
      return [
        { label: "Just starting, 5 min/day", summary: "New to the problem, tight on time.", answers: pick(() => 0) },
        { label: "Stuck veteran, 20 min/day", summary: "Tried everything, has time.", answers: pick(() => 1) },
        { label: "Mixed bag, deadline looming", summary: "Some history, real pressure.", answers: pick((i) => i % 2) },
      ];
    },

    async generateOutput(args) {
      // language_spanish produces near-identical documents so the swap test fires
      const identical = current?.id === "language_spanish";
      const seed = identical ? "shared" : Object.values(args.answers).join(" ").slice(0, 60);
      const filler = (n: number) =>
        Array.from({ length: 30 }, (_, i) => `${seed} block${n} word${i}`).join(" ");

      const sections: GeneratedOutput["sections"] = {};
      for (const s of args.template.sections) {
        const base = {
          callout: { label: "Your situation", body: `Based on your answers: ${seed}.` },
          intro: [filler(0)],
        };
        switch (s.component) {
          case "cards":
            sections[s.id] = { ...base, cards: [0, 1, 2].map((i) => ({
              kicker: `CARD 0${i + 1}`, title: `Card ${i} ${seed}`, body: filler(i + 1), tag: "mock" })) };
            break;
          case "timeline":
            sections[s.id] = { ...base, timeline: [0, 1, 2].map((i) => ({
              marker: String(i + 1), range: `Phase ${i + 1}`, title: `Step ${i} ${seed}`, body: filler(i + 4) })) };
            break;
          case "table":
            sections[s.id] = { ...base, table: { rows: [0, 1, 2, 3].map((i) => ({
              cells: [`Item ${i} ${seed}`, filler(i + 7).slice(0, 80), "now"], badge: "high" as const })) } };
            break;
          case "rhythm":
            sections[s.id] = { ...base, rhythm: [0, 1, 2].map((i) => ({
              time: `0${6 + i}:00`, title: `Slot ${i} ${seed}`, desc: filler(i + 11).slice(0, 90) })) };
            break;
          case "checklist":
            sections[s.id] = { ...base, checklist: [{ label: `Gate ${seed}`, items: [filler(14).slice(0, 60), filler(15).slice(0, 60)] }] };
            break;
          case "brief":
            sections[s.id] = { ...base, brief: { title: `Brief ${seed}`, groups: [
              { label: "A", items: [filler(16).slice(0, 60)] },
              { label: "B", items: [filler(17).slice(0, 60)] },
            ] } };
            break;
          default:
            sections[s.id] = base;
        }
      }
      return {
        cover: {
          title: `Your ${args.product.topic_title}`,
          subtitle: `Prepared for ${seed.slice(0, 30) || "you"}`,
          fingerprint: args.template.fingerprint_axes.map((_, i) => (i * 3) % 10),
          meta: [{ value: "mock", label: "Stage" }],
        },
        sections,
      };
    },

    async knowledgeCritic() {
      return { pass: true, score: 8, failures: [] };
    },
    async quizCritic() {
      return { pass: true, score: 7, failures: [] };
    },
    async outputCritic() {
      const base = current?.id === "budget_debt" ? 6.4 : 7.9;
      return {
        pass: base >= 7.5,
        weighted: base,
        scores: {
          specificity: { score: base - 0.5, why: "mock", evidence: "mock" },
          actionability: { score: base, why: "mock", evidence: "mock" },
          mechanism: { score: base + 0.3, why: "mock", evidence: "mock" },
          voice_match: { score: base + 0.2, why: "mock", evidence: "mock" },
          claims_safety: { score: current?.id === "budget_debt" ? 6 : 9.2, why: "mock", evidence: "mock" },
        },
        failures: [],
      };
    },
    async claimsCritic() {
      return { pass: true, score: 9, failures: [] };
    },
  };
}
