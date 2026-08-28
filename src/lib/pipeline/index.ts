import * as stages from "./stages";
import * as critics from "./critics";
import type { Usage } from "./ask";
import type { PipelineApi } from "./mock";
import { createMockApi } from "./mock";

export * from "./constants";
export * from "./swap";
export { createUsageTracker, parseModelJson, assertPipelineEnabled } from "./ask";
export type { Usage } from "./ask";
export type { PipelineApi } from "./mock";
export type { GenerateOutputArgs } from "./stages";
export { composeGenerationPrompt, readableAnswers } from "./stages";
export { createMockApi } from "./mock";

/**
 * Real model-backed pipeline API. Pass a usage tracker to accumulate cost.
 * `feedback` (the creator's rejection reason on a rebuild) is injected into
 * every product-shaping prompt.
 */
export function createRealApi(usage?: Usage, feedback?: string): PipelineApi {
  const ctx = { usage, feedback };
  return {
    extractAudience: (creator) => stages.extractAudience(creator, ctx),
    proposeTopics: (audience) => stages.proposeTopics(audience, ctx),
    proposeBonusTopic: (audience, existing) => stages.proposeBonusTopic(audience, existing, ctx),
    buildKnowledgePack: (topic, audience) => stages.buildKnowledgePack(topic, audience, ctx),
    designOutputTemplate: (topic, pack, audience) =>
      stages.designOutputTemplate(topic, pack, audience, ctx),
    designQuiz: (topic, pack, audience, template) =>
      stages.designQuiz(topic, pack, audience, template, ctx),
    writeGenerationPrompt: (topic, pack, template, voice, safety) =>
      stages.writeGenerationPrompt(topic, pack, template, voice, safety, ctx),
    inventSampleBuyers: (quiz, audience) => stages.inventSampleBuyers(quiz, audience, ctx),
    generateOutput: (args) => stages.generateOutput(args, ctx),
    knowledgeCritic: (pack) => critics.knowledgeCritic(pack, ctx),
    quizCritic: (quiz, template, pack, words) =>
      critics.quizCritic(quiz, template, pack, words, ctx),
    outputCritic: (buyerContext, documentText, rubric) =>
      critics.outputCritic(buyerContext, documentText, rubric, ctx),
    claimsCritic: (section, domain, banned) => critics.claimsCritic(section, domain, banned, ctx),
  };
}

/**
 * PIPELINE_MOCK=true swaps every model call for the mock layer, so the whole
 * app can be exercised end-to-end without keys or cost.
 */
export function createPipelineApi(usage?: Usage, feedback?: string): PipelineApi {
  if (process.env.PIPELINE_MOCK === "true") return createMockApi();
  return createRealApi(usage, feedback);
}
