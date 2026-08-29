import { revalidatePath } from "next/cache";
import { inngest, type Events } from "./client";
import { supabaseAdmin } from "../supabase/admin";
import {
  createPipelineApi,
  createUsageTracker,
  readableAnswers,
  RUBRIC,
  MIN_SCORE,
  MIN_DIVERGENCE,
  SAMPLE_BUYER_COUNT,
  DEFAULT_PRICE_CENTS,
  defaultVoice,
  swapTest,
} from "../pipeline";
import { validateBlueprint, flattenGeneratedOutput } from "../blueprint/validate";
import type {
  AudienceCard,
  Blueprint,
  CreatorInput,
  GeneratedOutput,
  KnowledgePack,
  OutputTemplate,
  Quiz,
  Safety,
  SampleBuyer,
  TopicProposal,
} from "../blueprint/types";
import type { OrderRow } from "../db/types";
import { scrapeCreator } from "../scrape";
import {
  sendAbandonedCheckout,
  sendBuildDeclined,
  sendIdeaReminder,
  sendIdeasReady,
  sendLaunchNudge,
  sendMilestone,
  sendPlanDelivered,
  sendReviewReminder,
  sendSaleNotification,
  sendSamplesReady,
  sendYoureLive,
  type LaunchNudgeVariant,
} from "../email";
import { generateShareKit } from "../share-kit";
import { CREATOR_KEEP_PCT } from "../seo";
import type { ShareKit } from "../db/types";

const db = () => supabaseAdmin();

/**
 * One-shot lifecycle email dedupe: the unique constraint on
 * (creator_id, type, ref_id) makes the insert the claim. Send only when the
 * claim succeeds — safe across cron runs and Inngest retries.
 */
async function claimLifecycleEmail(
  creatorId: string,
  type: string,
  refId = ""
): Promise<boolean> {
  const { error } = await db()
    .from("lifecycle_emails")
    .insert({ creator_id: creatorId, type, ref_id: refId });
  return !error;
}

async function updateBuild(buildId: string, patch: Record<string, unknown>) {
  const { error } = await db().from("builds").update(patch).eq("id", buildId);
  if (error) throw new Error(`builds update: ${error.message}`);
}

/**
 * Copy the scraped Instagram identity onto the creator row: name directly,
 * photo via the avatars bucket (the scraped CDN URL is signed and expires).
 * From then on the app shows the Instagram identity, not the Google one.
 * Non-fatal — a build should never die over a profile photo.
 */
async function syncCreatorProfile(creatorId: string, fullName: string, igAvatarUrl: string) {
  try {
    const patch: Record<string, string> = {};
    if (fullName.trim()) patch.display_name = fullName.trim();
    if (igAvatarUrl) {
      const res = await fetch(igAvatarUrl);
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        const contentType = res.headers.get("content-type") ?? "image/jpeg";
        const path = `${creatorId}.jpg`;
        const { error } = await db()
          .storage.from("avatars")
          .upload(path, buf, { contentType, upsert: true });
        if (!error) {
          const { data } = db().storage.from("avatars").getPublicUrl(path);
          // cache-buster: same storage path on every re-scrape, fresh URL
          patch.avatar_url = `${data.publicUrl}?v=${Date.now()}`;
        }
      }
    }
    if (Object.keys(patch).length) {
      await db().from("creators").update(patch).eq("id", creatorId);
    }
  } catch (e) {
    console.error("[syncCreatorProfile] non-fatal:", e);
  }
}

async function addCost(buildId: string, usd: number) {
  if (!usd) return;
  const { data } = await db().from("builds").select("cost_usd").eq("id", buildId).single();
  await updateBuild(buildId, { cost_usd: Number(data?.cost_usd ?? 0) + usd });
}

async function assertDailyCap() {
  const cap = Number(process.env.DAILY_SPEND_CAP_USD || 100);
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const { data } = await db()
    .from("builds")
    .select("cost_usd")
    .gte("created_at", since.toISOString());
  const spent = (data ?? []).reduce((t, r) => t + Number(r.cost_usd ?? 0), 0);
  if (spent >= cap) {
    throw new Error(`Daily spend cap reached ($${spent.toFixed(2)} >= $${cap}).`);
  }
}

function mockCreatorInput(handle: string, selfDescription?: string): CreatorInput {
  return {
    id: handle,
    handle,
    bio: "Dog trainer. Calm walks, no gimmicks. DMs open.",
    captions: [
      "Your dog isn't stubborn — the walk is the most exciting thing in his day",
      "Stop correcting the pull. Start lowering the arousal he walks out the door with",
      "Adolescence is when everything you trained falls apart. It comes back",
      "The first five minutes of the walk decide the other twenty-five",
      "A tired dog isn't a calm dog. Those are different states",
    ],
    comments: [
      "My 14 month old pulls so hard the first five minutes I dread walks now",
      "I've tried three trainers and nothing sticks, is my dog just different?",
      "How do I stop the lunging when another dog appears? Fine otherwise",
      "We walk an hour a day and he still pulls the whole time, I'm exhausted",
      "My rescue freezes and stares at other dogs, I never know what to do",
      "The no-pull harness worked for a week and then he pulled through it",
      "Why does he only pull on the way home? It's like he wants the walk over",
      "I only have 10 minutes a day to train, is that even enough to fix this?",
      "My 8 year old lab has pulled his whole life, is it too late for him?",
    ],
    self_description: selfDescription || "I help owners of pulling, reactive dogs get calm walks.",
  };
}

const STAGE_STATUS = { status: "running" } as const;

const DEFAULT_SAFETY: Safety = {
  domain_risk_tier: "low",
  disclaimers: [],
  banned_claims: [],
  escalation_triggers: [],
};

/** Buyer description handed to the output critic. */
function buyerContextFor(label: string, answers: Record<string, string>): string {
  return `${label}\nQuiz answers:\n${Object.entries(answers)
    .map(([q, a]) => `- ${q}: ${a}`)
    .join("\n")}`;
}

/** One flat text document for divergence/critic checks. */
function documentTextFor(template: OutputTemplate, output: GeneratedOutput): string {
  const flat = flattenGeneratedOutput(template, output);
  return template.sections
    .filter((s) => flat[s.id])
    .map((s) => `## ${s.title}\n${flat[s.id]}`)
    .join("\n\n");
}

// ============================================================ blueprint.build
export const blueprintBuild = inngest.createFunction(
  {
    id: "blueprint-build",
    concurrency: { limit: 3 },
    retries: 2,
    triggers: [{ event: "build/requested" }],
    // fired when the creator clicks "none of these fit" — the run is parked on
    // wait-topic and the build row is gone, so kill it instead of letting it
    // time out against a deleted row 7 days later
    cancelOn: [{ event: "build/discarded", if: "async.data.buildId == event.data.buildId" }],
    // if the run exhausts all retries, don't leave the row on "running" forever —
    // a failed build frees the creator's quota so they can start over
    onFailure: async ({ event, error }) => {
      const data = event.data.event.data as Events["build/requested"];
      if (!data?.buildId) return;
      await db()
        .from("builds")
        .update({
          status: "failed",
          halted_at: "pipeline_error",
          error: String(error?.message ?? error).slice(0, 500),
          completed_at: new Date().toISOString(),
        })
        .eq("id", data.buildId)
        .neq("status", "complete");
    },
  },
  async ({ event, step }) => {
    const { buildId, creatorId, handle, selfDescription, rebuildOfBuildId, rejectReason } =
      event.data as Events["build/requested"];

    const declined = async (haltedAt: string, note: string) => {
      const { data: creator } = await db()
        .from("creators")
        .select("email, handle")
        .eq("id", creatorId)
        .single();
      await updateBuild(buildId, {
        status: "declined",
        halted_at: haltedAt,
        error: note,
        completed_at: new Date().toISOString(),
      });
      if (creator?.email) await sendBuildDeclined(creator.email, creator.handle ?? handle, note);
    };

    // ---- 1. scrape (or copy from the rejected build on a rebuild) ----------
    const creatorInput = await step.run("scrape", async (): Promise<CreatorInput> => {
      await updateBuild(buildId, { ...STAGE_STATUS, stage: "scrape" });
      if (rebuildOfBuildId) {
        const { data: prev } = await db()
          .from("builds")
          .select("scrape_data")
          .eq("id", rebuildOfBuildId)
          .single();
        if (prev?.scrape_data?.creator_input) {
          return prev.scrape_data.creator_input as CreatorInput;
        }
      }
      let input: CreatorInput;
      let thin = false;
      if (process.env.PIPELINE_MOCK === "true" || !process.env.SCRAPECREATORS_API_KEY) {
        input = mockCreatorInput(handle, selfDescription);
      } else {
        const s = await scrapeCreator(handle);
        thin = s.thin;
        await syncCreatorProfile(creatorId, s.fullName, s.avatarUrl);
        input = {
          handle: s.handle,
          bio: s.bio,
          captions: s.captions,
          comments: s.comments,
          self_description: selfDescription || s.bio,
        };
      }
      await updateBuild(buildId, { scrape_data: { creator_input: input, thin } });
      return input;
    });

    if (!creatorInput.captions.length && !creatorInput.comments.length) {
      await step.run("decline-thin", () =>
        declined(
          "thin_content",
          "Your account came back with too little public content to read your audience from."
        )
      );
      return { declined: "thin_content" };
    }

    // ---- 2. audience extraction + confidence gate ---------------------------
    const audience = await step.run("extract", async (): Promise<AudienceCard> => {
      await assertDailyCap();
      await updateBuild(buildId, { ...STAGE_STATUS, stage: "extract" });
      if (rebuildOfBuildId) {
        const { data: prev } = await db()
          .from("builds")
          .select("audience_card")
          .eq("id", rebuildOfBuildId)
          .single();
        if (prev?.audience_card) {
          await updateBuild(buildId, { audience_card: prev.audience_card });
          return prev.audience_card as AudienceCard;
        }
      }
      const usage = createUsageTracker();
      const scoped = createPipelineApi(usage, rejectReason);
      const card = await scoped.extractAudience(creatorInput);
      await updateBuild(buildId, { audience_card: card });
      await addCost(buildId, usage.cost_usd);
      return card;
    });

    const minConf = Math.min(...Object.values(audience.confidence ?? { x: 1 }));
    if (minConf < 0.5) {
      await step.run("decline-confidence", () =>
        declined(
          "audience_confidence",
          "We couldn't read your audience confidently enough from what's public."
        )
      );
      return { declined: "audience_confidence" };
    }

    // ---- 3. topic proposals + pause for the creator's pick ------------------
    let chosen: TopicProposal | null = null;

    const prevChosen = rebuildOfBuildId
      ? await step.run("copy-topic", async () => {
          const { data: prev } = await db()
            .from("builds")
            .select("chosen_topic, topic_proposals")
            .eq("id", rebuildOfBuildId)
            .single();
          if (prev?.chosen_topic) {
            await updateBuild(buildId, {
              chosen_topic: prev.chosen_topic,
              topic_proposals: prev.topic_proposals,
            });
          }
          return (prev?.chosen_topic as TopicProposal) ?? null;
        })
      : null;

    if (prevChosen) {
      chosen = prevChosen;
    } else {
      let proposals = await step.run("propose", async () => {
        await updateBuild(buildId, { ...STAGE_STATUS, stage: "propose" });
        const usage = createUsageTracker();
        const scoped = createPipelineApi(usage, rejectReason);
        const topics = await scoped.proposeTopics(audience);
        await updateBuild(buildId, { topic_proposals: topics });
        await addCost(buildId, usage.cost_usd);
        return topics.proposals ?? [];
      });

      if (proposals.length) {
        // the wild card: one out-of-the-box idea appended after the safe three.
        // Non-fatal — three good ideas beat a failed build.
        proposals = await step.run("propose-bonus", async () => {
          try {
            const usage = createUsageTracker();
            const scoped = createPipelineApi(usage, rejectReason);
            const bonus = await scoped.proposeBonusTopic(audience, proposals);
            const all = [...proposals, { ...bonus, bonus: true }];
            await updateBuild(buildId, { topic_proposals: { proposals: all } });
            await addCost(buildId, usage.cost_usd);
            return all;
          } catch {
            return proposals;
          }
        });
      }

      if (!proposals.length) {
        await step.run("decline-topics", () =>
          declined(
            "no_viable_topic",
            "None of the product angles we found could be personalized honestly enough to sell."
          )
        );
        return { declined: "no_viable_topic" };
      }

      await step.run("await-topic-status", async () => {
        await updateBuild(buildId, { status: "awaiting_topic", stage: "propose" });
        const { data: creator } = await db()
          .from("creators")
          .select("email, handle")
          .eq("id", creatorId)
          .single();
        if (creator?.email) await sendIdeasReady(creator.email, creator.handle ?? handle);
      });

      const topicEvt = await step.waitForEvent("wait-topic", {
        event: "build/topic.chosen",
        if: `async.data.buildId == "${buildId}"`,
        timeout: "7d",
      });
      if (!topicEvt) {
        await step.run("timeout-topic", () =>
          updateBuild(buildId, {
            status: "failed",
            halted_at: "topic_timeout",
            error: "No topic chosen within 7 days.",
            completed_at: new Date().toISOString(),
          })
        );
        return { failed: "topic_timeout" };
      }
      const { topicIndex } = topicEvt.data as Events["build/topic.chosen"];
      chosen = proposals[topicIndex] ?? proposals[0];
      await step.run("record-topic", () =>
        updateBuild(buildId, { ...STAGE_STATUS, stage: "knowledge", chosen_topic: chosen })
      );
    }

    const topic = chosen!;
    // bonus ideas may have no time component at all; older transformation
    // proposals predate duration_days and default to 30
    const durationDays = topic.duration_days ?? (topic.bonus ? undefined : 30);
    const voice = defaultVoice(audience.tone_notes);
    const criticResults: Record<string, unknown> = {};

    // ---- 4. knowledge pack + critic, ≤2 retries ------------------------------
    // one model call per step: a pack generation alone can run for minutes, and
    // bundling generation + critic rounds into a single step used to blow past
    // the serverless request timeout, so Inngest retried the whole thing forever
    let pack!: KnowledgePack;
    {
      const attempts: unknown[] = [];
      for (let ka = 1; ka <= 3; ka++) {
        pack = (await step.run(`knowledge-pack-${ka}`, async () => {
          await updateBuild(buildId, { ...STAGE_STATUS, stage: "knowledge" });
          const usage = createUsageTracker();
          const scoped = createPipelineApi(usage, rejectReason);
          const candidate = await scoped.buildKnowledgePack(topic, audience);
          await addCost(buildId, usage.cost_usd);
          return candidate;
        })) as KnowledgePack;
        const snapshot = pack;
        const critic = await step.run(`knowledge-critic-${ka}`, async () => {
          const usage = createUsageTracker();
          const scoped = createPipelineApi(usage, rejectReason);
          const result = await scoped.knowledgeCritic(snapshot);
          await addCost(buildId, usage.cost_usd);
          return result;
        });
        attempts.push(critic);
        if (critic.pass) break;
      }
      criticResults.knowledge = attempts;
      await step.run("knowledge-critics", () =>
        updateBuild(buildId, { critic_results: criticResults })
      );
    }

    // ---- 5. output template ---------------------------------------------------
    const template = (await step.run("template", async () => {
      await updateBuild(buildId, { ...STAGE_STATUS, stage: "template" });
      const usage = createUsageTracker();
      const scoped = createPipelineApi(usage, rejectReason);
      const t = await scoped.designOutputTemplate(topic, pack, audience);
      await addCost(buildId, usage.cost_usd);
      return t;
    })) as OutputTemplate;

    // ---- 6. product-specific generation prompt --------------------------------
    const generationPrompt = (await step.run("generation-prompt", async () => {
      await updateBuild(buildId, { ...STAGE_STATUS, stage: "prompt" });
      const usage = createUsageTracker();
      const scoped = createPipelineApi(usage, rejectReason);
      const rules = await scoped.writeGenerationPrompt(topic, pack, template, voice, DEFAULT_SAFETY);
      await addCost(buildId, usage.cost_usd);
      return rules;
    })) as string;

    const draftBlueprint = (quiz: Quiz): Blueprint => ({
      blueprint_id: `bp_${creatorId}`,
      blueprint_version: 0,
      status: "draft",
      creator: { handle, audience_card: audience },
      product: {
        topic_title: topic.topic_title,
        promise: topic.promise,
        duration_days: durationDays,
        price_usd: DEFAULT_PRICE_CENTS / 100,
      },
      knowledge_pack: pack,
      quiz,
      output: { template, generation_prompt: generationPrompt, voice },
      safety: DEFAULT_SAFETY,
      eval: {
        rubric: RUBRIC,
        swap_test: { min_divergence_pct: MIN_DIVERGENCE },
        thresholds: { min_weighted_score: MIN_SCORE },
      },
    });

    // ---- 7-9. quiz → persona samples → swap, with one full retry on swap fail
    let quiz: Quiz | null = null;
    let buyers: SampleBuyer[] = [];
    let sampleOutputs: GeneratedOutput[] = [];
    let swapPassed = false;

    for (let attempt = 1; attempt <= 2 && !swapPassed; attempt++) {
      // quiz + structural validation, ≤2 regenerations
      const quizResult = await step.run(`quiz-${attempt}`, async () => {
        await updateBuild(buildId, { ...STAGE_STATUS, stage: "quiz" });
        const usage = createUsageTracker();
        const scoped = createPipelineApi(usage, rejectReason);
        let lastErrors: unknown[] = [];
        for (let qa = 0; qa < 3; qa++) {
          const candidate = await scoped.designQuiz(topic, pack, audience, template);
          const structural = validateBlueprint(draftBlueprint(candidate));
          if (!structural.errors.length) {
            const critic = await scoped.quizCritic(
              candidate,
              template,
              pack,
              audience.audience_words ?? []
            );
            await addCost(buildId, usage.cost_usd);
            return { quiz: candidate, structuralErrors: [], critic };
          }
          lastErrors = structural.errors;
        }
        await addCost(buildId, usage.cost_usd);
        return { quiz: null, structuralErrors: lastErrors, critic: null };
      });

      if (!quizResult.quiz) {
        await step.run(`fail-structural-${attempt}`, () =>
          updateBuild(buildId, {
            status: "failed",
            halted_at: "structural_validation",
            error: JSON.stringify(quizResult.structuralErrors.slice(0, 3)),
            completed_at: new Date().toISOString(),
          })
        );
        return { failed: "structural_validation" };
      }
      quiz = quizResult.quiz as Quiz;
      criticResults[`quiz_attempt_${attempt}`] = quizResult.critic;
      const frozenQuiz = quiz;

      // three deliberately different synthetic buyers answer the real quiz
      buyers = (await step.run(`sample-buyers-${attempt}`, async () => {
        await updateBuild(buildId, { ...STAGE_STATUS, stage: "samples" });
        const usage = createUsageTracker();
        const scoped = createPipelineApi(usage, rejectReason);
        const invented = await scoped.inventSampleBuyers(frozenQuiz, audience);
        await addCost(buildId, usage.cost_usd);
        return invented.slice(0, SAMPLE_BUYER_COUNT);
      })) as SampleBuyer[];

      // each sample runs the REAL runtime path: one generation per buyer,
      // one step per buyer to stay under the serverless request timeout
      sampleOutputs = [];
      for (let i = 0; i < buyers.length; i++) {
        const buyer = buyers[i];
        const output = (await step.run(`sample-${attempt}-${i + 1}`, async () => {
          await updateBuild(buildId, { ...STAGE_STATUS, stage: "samples" });
          const usage = createUsageTracker();
          const scoped = createPipelineApi(usage, rejectReason);
          const generated = await scoped.generateOutput({
            template,
            generationPrompt,
            knowledgePack: pack,
            voice,
            safety: DEFAULT_SAFETY,
            product: {
              topic_title: topic.topic_title,
              promise: topic.promise,
              duration_days: durationDays,
            },
            creatorName: handle,
            answers: readableAnswers(frozenQuiz, buyer.answers),
          });
          await addCost(buildId, usage.cost_usd);
          return generated;
        })) as GeneratedOutput;
        sampleOutputs.push(output);
      }

      // swap test — deterministic and free: if three different buyers produce
      // near-identical documents, the personalization is theater
      const swap = await step.run(`swap-${attempt}`, async () => {
        await updateBuild(buildId, { ...STAGE_STATUS, stage: "swap_test" });
        const renders: Record<string, Record<string, string>> = {};
        buyers.forEach((b, i) => {
          renders[`p${i}`] = flattenGeneratedOutput(template, sampleOutputs[i]);
        });
        const pairs: [string, string][] = [];
        for (let i = 0; i < buyers.length; i++) {
          for (let j = i + 1; j < buyers.length; j++) pairs.push([`p${i}`, `p${j}`]);
        }
        const result = swapTest(renders, pairs, MIN_DIVERGENCE);
        criticResults[`swap_attempt_${attempt}`] = result;
        await updateBuild(buildId, { critic_results: criticResults });
        return result;
      });

      swapPassed = swap.pass;
      if (!swapPassed && attempt === 2) {
        await step.run("fail-swap", () =>
          updateBuild(buildId, {
            status: "failed",
            halted_at: "swap_test",
            error:
              "Different buyers received near-identical documents — quiz regeneration did not fix it.",
            completed_at: new Date().toISOString(),
          })
        );
        return { failed: "swap_test" };
      }
    }

    // ---- 10. output critic + quality gate -------------------------------------
    const gate = await step.run("critique", async () => {
      await updateBuild(buildId, { ...STAGE_STATUS, stage: "critique" });
      const usage = createUsageTracker();
      const scoped = createPipelineApi(usage, rejectReason);
      const scored: { persona: string; weighted: number; scores: unknown }[] = [];
      for (let i = 0; i < buyers.length; i++) {
        const context = buyerContextFor(buyers[i].label, readableAnswers(quiz!, buyers[i].answers));
        const r = await scoped.outputCritic(
          context,
          documentTextFor(template, sampleOutputs[i]),
          RUBRIC
        );
        scored.push({ persona: buyers[i].label, weighted: r.weighted ?? 0, scores: r.scores });
      }
      const weighted = scored.reduce((t, s) => t + s.weighted, 0) / (scored.length || 1);
      criticResults.output = scored;
      criticResults.weighted = +weighted.toFixed(2);
      await updateBuild(buildId, { critic_results: criticResults });
      await addCost(buildId, usage.cost_usd);
      return { weighted: +weighted.toFixed(2) };
    });

    if (gate.weighted < MIN_SCORE) {
      await step.run("fail-gate", () =>
        updateBuild(buildId, {
          status: "failed",
          halted_at: "quality_gate",
          error: `Weighted score ${gate.weighted} below ${MIN_SCORE}.`,
          completed_at: new Date().toISOString(),
        })
      );
      return { failed: "quality_gate", weighted: gate.weighted };
    }

    // ---- 11. persist blueprint + samples, pause for creator approval ---------
    const blueprintId = await step.run("persist-blueprint", async () => {
      await updateBuild(buildId, { ...STAGE_STATUS, stage: "gate" });
      const { data: prev } = await db()
        .from("blueprints")
        .select("version")
        .eq("creator_id", creatorId)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      const version = (prev?.version ?? 0) + 1;

      const blueprint: Blueprint = {
        blueprint_id: `bp_${handle}_v${version}`,
        blueprint_version: version,
        archetype_version: "personalized_plan_v1",
        status: "complete",
        created_at: new Date().toISOString(),
        creator: {
          handle,
          display_name: undefined,
          credibility_statement: audience.credibility_basis,
          audience_card: audience,
        },
        product: {
          topic_title: topic.topic_title,
          promise: topic.promise,
          duration_days: durationDays,
          phase_length_days: durationDays ? Math.round(durationDays / 4) : undefined,
          price_usd: DEFAULT_PRICE_CENTS / 100,
          format: "web",
        },
        knowledge_pack: pack,
        quiz: quiz!,
        output: { template, generation_prompt: generationPrompt, voice },
        safety: DEFAULT_SAFETY,
        eval: {
          rubric: RUBRIC,
          swap_test: { min_divergence_pct: MIN_DIVERGENCE },
          thresholds: { min_weighted_score: MIN_SCORE, max_regeneration_attempts: 2 },
        },
      };

      const { data: bpRow, error } = await db()
        .from("blueprints")
        .insert({
          creator_id: creatorId,
          build_id: buildId,
          version,
          status: "complete",
          data: blueprint,
          price_cents: DEFAULT_PRICE_CENTS,
        })
        .select("id")
        .single();
      if (error) throw new Error(`blueprints insert: ${error.message}`);

      const sampleRows = buyers.map((b, i) => ({
        blueprint_id: bpRow.id,
        persona: `persona_${i + 1}`,
        persona_label: b.label,
        sections: sampleOutputs[i],
      }));
      const { error: sErr } = await db().from("samples").insert(sampleRows);
      if (sErr) throw new Error(`samples insert: ${sErr.message}`);

      await updateBuild(buildId, { status: "awaiting_approval", stage: "gate" });
      const { data: creator } = await db()
        .from("creators")
        .select("email")
        .eq("id", creatorId)
        .single();
      if (creator?.email) await sendSamplesReady(creator.email, topic.topic_title);
      return bpRow.id as string;
    });

    const review = await step.waitForEvent("wait-review", {
      event: "build/samples.reviewed",
      if: `async.data.buildId == "${buildId}"`,
      timeout: "14d",
    });

    if (!review) {
      await step.run("timeout-review", () =>
        updateBuild(buildId, {
          status: "failed",
          halted_at: "review_timeout",
          error: "Samples not reviewed within 14 days.",
          completed_at: new Date().toISOString(),
        })
      );
      return { failed: "review_timeout" };
    }

    const reviewData = review.data as Events["build/samples.reviewed"];
    if (!reviewData.approved) {
      // Rejection with a reason triggers a rebuild that reuses the scrape,
      // audience card, and chosen topic, and regenerates everything downstream.
      const newBuildId = await step.run("record-rejection", async () => {
        await updateBuild(buildId, {
          status: "failed",
          halted_at: "rejected_by_creator",
          reject_reason: reviewData.reason ?? null,
          completed_at: new Date().toISOString(),
        });
        await db().from("blueprints").update({ status: "archived" }).eq("id", blueprintId);
        const { data: next, error } = await db()
          .from("builds")
          .insert({ creator_id: creatorId, status: "queued" })
          .select("id")
          .single();
        if (error) throw new Error(`rebuild insert: ${error.message}`);
        return next.id as string;
      });
      await step.sendEvent("trigger-rebuild", {
        name: "build/requested",
        data: {
          buildId: newBuildId,
          creatorId,
          handle,
          rebuildOfBuildId: buildId,
          rejectReason: reviewData.reason,
        },
      });
      return { rejected: true, rebuild: newBuildId };
    }

    // ---- 12. approval: freeze, version, publish -------------------------------
    await step.run("publish", async () => {
      await updateBuild(buildId, { stage: "publish" });
      const { data: creator } = await db()
        .from("creators")
        .select("user_id, display_name")
        .eq("id", creatorId)
        .single();
      const now = new Date().toISOString();

      // unpublish + archive any previous published version
      await db()
        .from("blueprints")
        .update({ published: false, status: "archived" })
        .eq("creator_id", creatorId)
        .eq("published", true);

      const { data: bpRow } = await db()
        .from("blueprints")
        .select("data")
        .eq("id", blueprintId)
        .single();
      const data = bpRow!.data as Blueprint;
      // Approval is a human action — this runs only after the creator's
      // explicit approve event. Never set programmatically outside this gate.
      data.status = "approved";
      data.approved_at = now;
      data.approved_by = `creator:${handle}`;
      if (creator?.display_name) data.creator.display_name = creator.display_name;

      const { error } = await db()
        .from("blueprints")
        .update({
          status: "approved",
          approved_at: now,
          approved_by: creator?.user_id ?? null,
          published: true,
          data,
        })
        .eq("id", blueprintId);
      if (error) throw new Error(`publish: ${error.message}`);

      await updateBuild(buildId, {
        status: "complete",
        completed_at: now,
      });

      revalidatePath("/sitemap.xml");
      revalidatePath(`/u/${handle}`);
    });

    // Paste-ready promotion copy, written from the product itself. Non-fatal:
    // the launch screen falls back to deterministic copy if this is null.
    const shareKit = await step.run("share-kit", async (): Promise<ShareKit | null> => {
      try {
        const usage = createUsageTracker();
        const kit = await generateShareKit(
          {
            handle,
            topicTitle: topic.topic_title,
            promise: topic.promise,
            priceCents: DEFAULT_PRICE_CENTS,
            durationDays,
            audienceCard: audience,
          },
          usage
        );
        await db().from("blueprints").update({ share_kit: kit }).eq("id", blueprintId);
        await addCost(buildId, usage.cost_usd);
        return kit;
      } catch (e) {
        console.error("[share-kit] non-fatal:", e);
        return null;
      }
    });

    // The launch moment must not be silent: tell the creator they're live and
    // hand them the first post, ready to paste.
    await step.run("youre-live-email", async () => {
      const { data: creator } = await db()
        .from("creators")
        .select("id, email")
        .eq("id", creatorId)
        .single();
      if (!creator?.email) return;
      if (!(await claimLifecycleEmail(creator.id, "youre_live", blueprintId))) return;
      await sendYoureLive(creator.email, {
        handle,
        topicTitle: topic.topic_title,
        priceCents: DEFAULT_PRICE_CENTS,
        kit: shareKit,
      });
    });

    return { published: true, blueprintId };
  }
);

// ============================================================== plan.generate
export const planGenerate = inngest.createFunction(
  {
    id: "plan-generate",
    // free Inngest plan caps concurrency at 5 — raise this when the plan allows
    concurrency: { limit: 5 },
    retries: 2,
    triggers: [{ event: "order/paid" }],
  },
  async ({ event, step }) => {
    const { orderId } = event.data as Events["order/paid"];

    const ctx = await step.run("resolve", async () => {
      const { data: order, error } = await db()
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .single();
      if (error || !order) throw new Error(`order not found: ${orderId}`);
      const { data: bpRow, error: bErr } = await db()
        .from("blueprints")
        .select("*, creators!inner(display_name, handle)")
        .eq("id", order.blueprint_id)
        .single();
      if (bErr || !bpRow) throw new Error(`blueprint not found for order ${orderId}`);

      await db().from("orders").update({ status: "generating" }).eq("id", orderId);
      return {
        order: order as OrderRow,
        blueprintRowId: bpRow.id as string,
        creatorId: bpRow.creator_id as string,
        blueprint: bpRow.data as Blueprint,
        creatorName:
          (bpRow.creators?.display_name as string) ??
          (bpRow.creators?.handle as string) ??
          (bpRow.data as Blueprint).creator.handle,
      };
    });

    // A sale is the creator's activation moment — never let it pass silently.
    // Runs before generation so the notification isn't delayed by the writer.
    await step.run("notify-creator", async () => {
      const { data: creator } = await db()
        .from("creators")
        .select("id, email, first_sale_at")
        .eq("id", ctx.creatorId)
        .single();
      if (!creator) return;

      // every sale across all of this creator's blueprint versions, in order
      const { data: bpIds } = await db()
        .from("blueprints")
        .select("id")
        .eq("creator_id", creator.id);
      const ids = (bpIds ?? []).map((b) => b.id as string);
      const { data: orderRows } = await db()
        .from("orders")
        .select("id, amount_cents, created_at")
        .in("blueprint_id", ids)
        .in("status", ["paid", "generating", "delivered"])
        .order("created_at", { ascending: true });
      const orders = orderRows ?? [];
      const idx = orders.findIndex((o) => o.id === orderId);
      const saleNumber = idx === -1 ? orders.length : idx + 1;

      if (saleNumber === 1 && !creator.first_sale_at) {
        await db()
          .from("creators")
          .update({ first_sale_at: new Date().toISOString() })
          .eq("id", creator.id)
          .is("first_sale_at", null);
      }

      if (!creator.email) return;
      const topicTitle = (ctx.blueprint as Blueprint).product.topic_title;

      if (await claimLifecycleEmail(creator.id, "sale", orderId)) {
        await sendSaleNotification(creator.email, {
          topicTitle,
          priceCents: ctx.order.amount_cents,
          saleNumber,
        });
      }

      // milestones — each fires once, ever
      if (saleNumber >= 5 && (await claimLifecycleEmail(creator.id, "milestone_5"))) {
        await sendMilestone(creator.email, { kind: "5_sales", topicTitle });
      }
      if (saleNumber >= 10 && (await claimLifecycleEmail(creator.id, "milestone_10"))) {
        await sendMilestone(creator.email, { kind: "10_sales", topicTitle });
      }
      const netCents = orders
        .slice(0, Math.max(saleNumber, 1))
        .reduce((t, o) => t + (o.amount_cents as number), 0) * (CREATOR_KEEP_PCT / 100);
      if (netCents >= 10000 && (await claimLifecycleEmail(creator.id, "milestone_100usd"))) {
        await sendMilestone(creator.email, { kind: "100_usd", topicTitle });
      }
    });

    const bp = ctx.blueprint;
    const answers = readableAnswers(bp.quiz, ctx.order.quiz_answers);
    const generateArgs = {
      template: bp.output.template,
      generationPrompt: bp.output.generation_prompt,
      knowledgePack: bp.knowledge_pack,
      voice: bp.output.voice,
      safety: bp.safety,
      product: {
        topic_title: bp.product.topic_title,
        promise: bp.product.promise,
        duration_days: bp.product.duration_days,
      },
      creatorName: ctx.creatorName,
      answers,
    };
    const buyerContext = buyerContextFor(`Buyer ${ctx.order.buyer_email}`, answers);

    const t0 = Date.now();

    // ONE model call writes the whole document from the buyer's full answers.
    // Structural validation (with one internal retry) happens inside
    // generateOutput; the critic gate below buys one full regeneration. A paid
    // order must deliver, so if the retry still fails the gate we ship the
    // better-scoring attempt rather than the order.
    const minScore = bp.eval.thresholds?.min_weighted_score ?? MIN_SCORE;
    const attempts: { output: GeneratedOutput; weighted: number; pass: boolean }[] = [];
    for (let attempt = 1; attempt <= 2; attempt++) {
      const output = (await step.run(`generate-${attempt}`, async () => {
        const usage = createUsageTracker();
        const scoped = createPipelineApi(usage);
        return scoped.generateOutput(generateArgs);
      })) as GeneratedOutput;

      const critic = await step.run(`critic-${attempt}`, async () => {
        const usage = createUsageTracker();
        const scoped = createPipelineApi(usage);
        return scoped.outputCritic(
          buyerContext,
          documentTextFor(bp.output.template, output),
          bp.eval.rubric
        );
      });

      const weighted = critic.weighted ?? 0;
      attempts.push({ output, weighted, pass: critic.pass || weighted >= minScore });
      if (attempts[attempts.length - 1].pass) break;
    }
    const finalOutput = (
      attempts.find((a) => a.pass) ??
      attempts.slice().sort((a, b) => b.weighted - a.weighted)[0]
    ).output;

    await step.run("assemble", async () => {
      const { data: existing } = await db()
        .from("outputs")
        .select("id")
        .eq("order_id", orderId)
        .maybeSingle();
      if (existing) return existing.id as string;
      const { data, error } = await db()
        .from("outputs")
        .insert({
          order_id: orderId,
          sections: finalOutput,
          generation_ms: Date.now() - t0,
        })
        .select("id")
        .single();
      if (error) throw new Error(`outputs insert: ${error.message}`);
      return data.id as string;
    });

    await step.run("deliver", async () => {
      await sendPlanDelivered(ctx.order.buyer_email, {
        topicTitle: bp.product.topic_title,
        creatorName: ctx.creatorName,
        orderId,
      });
      await db().from("orders").update({ status: "delivered" }).eq("id", orderId);
    });

    return { delivered: true, orderId };
  }
);

// ============================================================ lifecycle.cron
const HOUR_MS = 3600_000;
const DAY_MS = 24 * HOUR_MS;

/**
 * Hourly sweep for everything time-based on the road to activation:
 * - reminders before the 7-day idea and 14-day review timeouts silently expire
 * - "live but silent" nudges for published creators with no sale yet
 * - abandoned-checkout recovery emails to buyers who finished the quiz
 *
 * All one-shot sends are deduped through lifecycle_emails (creators) or
 * quiz_sessions.abandoned_email_sent_at (buyers), so re-runs are safe.
 */
export const lifecycleCron = inngest.createFunction(
  { id: "lifecycle-cron", retries: 1, triggers: [{ cron: "0 * * * *" }] },
  async ({ step }) => {
    // ---- idea-pick reminders (7-day timeout) -------------------------------
    await step.run("idea-reminders", async () => {
      const { data } = await db()
        .from("builds")
        .select("id, creator_id, created_at, creators(email)")
        .eq("status", "awaiting_topic")
        .lt("created_at", new Date(Date.now() - 3 * DAY_MS).toISOString());
      for (const b of data ?? []) {
        const email = (b.creators as unknown as { email: string } | null)?.email;
        if (!email) continue;
        const ageDays = (Date.now() - new Date(b.created_at).getTime()) / DAY_MS;
        if (ageDays >= 7.5) continue; // wait already timed out
        const daysLeft = Math.max(1, Math.ceil(7 - ageDays));
        const type = ageDays >= 6 ? "idea_reminder_final" : "idea_reminder";
        if (await claimLifecycleEmail(b.creator_id, type, b.id)) {
          await sendIdeaReminder(email, { daysLeft });
        }
      }
    });

    // ---- sample-review reminders (14-day timeout) --------------------------
    await step.run("review-reminders", async () => {
      const { data } = await db()
        .from("builds")
        .select("id, creator_id, creators(email)")
        .eq("status", "awaiting_approval");
      for (const b of data ?? []) {
        const email = (b.creators as unknown as { email: string } | null)?.email;
        if (!email) continue;
        // the wait starts when the blueprint row is persisted, not at build start
        const { data: bp } = await db()
          .from("blueprints")
          .select("created_at, data")
          .eq("build_id", b.id)
          .maybeSingle();
        if (!bp) continue;
        const ageDays = (Date.now() - new Date(bp.created_at).getTime()) / DAY_MS;
        if (ageDays < 3 || ageDays >= 14.5) continue;
        const daysLeft = Math.max(1, Math.ceil(14 - ageDays));
        const type = ageDays >= 11 ? "review_reminder_final" : "review_reminder";
        if (await claimLifecycleEmail(b.creator_id, type, b.id)) {
          await sendReviewReminder(email, {
            topicTitle: (bp.data as Blueprint).product.topic_title,
            daysLeft,
          });
        }
      }
    });

    // ---- live-but-silent launch nudges -------------------------------------
    await step.run("launch-nudges", async () => {
      const { data } = await db()
        .from("blueprints")
        .select(
          "id, creator_id, approved_at, created_at, share_kit, data, creators!inner(id, email, handle, first_sale_at)"
        )
        .eq("published", true);
      for (const bp of data ?? []) {
        const c = bp.creators as unknown as {
          id: string;
          email: string | null;
          handle: string | null;
          first_sale_at: string | null;
        };
        if (!c?.email || !c.handle || c.first_sale_at) continue;
        const liveMs = Date.now() - new Date(bp.approved_at ?? bp.created_at).getTime();
        if (liveMs < HOUR_MS) continue;

        const { count: visits } = await db()
          .from("creator_events")
          .select("id", { count: "exact", head: true })
          .eq("creator_id", c.id)
          .eq("type", "page_visit");
        const { count: quizStarts } = await db()
          .from("quiz_sessions")
          .select("id", { count: "exact", head: true })
          .eq("creator_id", c.id);

        // most advanced eligible stage first; one nudge per stage, ever
        const stages: { variant: LaunchNudgeVariant; eligible: boolean }[] = [
          { variant: "7d", eligible: liveMs >= 7 * DAY_MS },
          { variant: "3d", eligible: liveMs >= 3 * DAY_MS },
          { variant: "24h", eligible: liveMs >= DAY_MS && (quizStarts ?? 0) === 0 },
          { variant: "1h", eligible: liveMs >= HOUR_MS && (visits ?? 0) === 0 },
        ];
        for (const s of stages) {
          if (!s.eligible) continue;
          if (!(await claimLifecycleEmail(c.id, `nudge_${s.variant}`, bp.id))) continue;
          await sendLaunchNudge(c.email, {
            variant: s.variant,
            handle: c.handle,
            topicTitle: (bp.data as Blueprint).product.topic_title,
            kit: (bp.share_kit as ShareKit | null) ?? null,
            visits: visits ?? 0,
            quizStarts: quizStarts ?? 0,
          });
          break;
        }
      }
    });

    // ---- abandoned-checkout recovery (buyers) -------------------------------
    await step.run("abandoned-checkouts", async () => {
      const { data } = await db()
        .from("quiz_sessions")
        .select("id, blueprint_id, email, updated_at")
        .in("status", ["quiz_completed", "checkout"])
        .not("email", "is", null)
        .is("abandoned_email_sent_at", null)
        .is("order_id", null)
        .lt("updated_at", new Date(Date.now() - 2 * HOUR_MS).toISOString())
        .gt("updated_at", new Date(Date.now() - 7 * DAY_MS).toISOString());
      for (const s of data ?? []) {
        const { data: bp } = await db()
          .from("blueprints")
          .select("published, price_cents, data, creators!inner(handle, display_name)")
          .eq("id", s.blueprint_id)
          .maybeSingle();
        // only recover toward a page that still exists
        if (!bp?.published) continue;
        const creator = bp.creators as unknown as {
          handle: string | null;
          display_name: string | null;
        };
        if (!creator?.handle) continue;
        // claim via the timestamp itself — the update only wins once
        const { data: claimed } = await db()
          .from("quiz_sessions")
          .update({ abandoned_email_sent_at: new Date().toISOString() })
          .eq("id", s.id)
          .is("abandoned_email_sent_at", null)
          .select("id");
        if (!claimed?.length) continue;
        const blueprint = bp.data as Blueprint;
        await sendAbandonedCheckout(s.email!, {
          creatorName: creator.display_name ?? `@${creator.handle}`,
          topicTitle: blueprint.product.topic_title,
          handle: creator.handle,
          sessionId: s.id,
          priceCents: bp.price_cents,
        });
      }
    });

    return { ok: true };
  }
);

export const functions = [blueprintBuild, planGenerate, lifecycleCron];
