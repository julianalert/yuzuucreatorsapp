import * as stages from "./stages";
import * as critics from "./critics";
import type { Usage } from "./ask";
import type { PipelineApi } from "./mock";
import { createMockApi } from "./mock";

export * from "./constants";
export * from "./swap";
export { createUsageTracker, parseModelJson, assertPipelineEnabled } from "./ask";
export type { Usage } from "./ask";
export type { PipelineApi, WriteBriefArgs, RenderSectionArgs } from "./mock";
export { createMockApi } from "./mock";

/** Real model-backed pipeline API. Pass a usage tracker to accumulate cost. */
export function createRealApi(usage?: Usage): PipelineApi {
  const ctx = { usage };
  return {
    extractAudience: (creator) => stages.extractAudience(creator, ctx),
    proposeTopics: (audience, duration) => stages.proposeTopics(audience, duration, ctx),
    buildKnowledgePack: (topic, audience) => stages.buildKnowledgePack(topic, audience, ctx),
    designQuiz: (pack, audience, skeleton) => stages.designQuiz(pack, audience, skeleton, ctx),
    writeBrief: (args) => stages.writeBrief(args, ctx),
    renderSection: (args) => stages.renderSection(args, ctx),
    knowledgeCritic: (pack) => critics.knowledgeCritic(pack, ctx),
    quizCritic: (quiz, pack, words) => critics.quizCritic(quiz, pack, words, ctx),
    outputCritic: (archetype, section, rubric) =>
      critics.outputCritic(archetype, section, rubric, ctx),
    claimsCritic: (section, domain, banned) => critics.claimsCritic(section, domain, banned, ctx),
  };
}

/**
 * PIPELINE_MOCK=true swaps every model call for the mock layer, so the whole
 * app can be exercised end-to-end without keys or cost.
 */
export function createPipelineApi(usage?: Usage): PipelineApi {
  if (process.env.PIPELINE_MOCK === "true") return createMockApi();
  return createRealApi(usage);
}
