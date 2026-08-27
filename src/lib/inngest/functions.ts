import { inngest, type Events } from "./client";
import { supabaseAdmin } from "../supabase/admin";
import {
  createPipelineApi,
  createUsageTracker,
  skeletonFor,
  RUBRIC,
  MIN_SCORE,
  MIN_DIVERGENCE,
  EVAL_SECTIONS,
  defaultVoice,
  swapTest,
} from "../pipeline";
import { validateBlueprint, resolveArchetype } from "../blueprint/validate";
import type {
  AudienceCard,
  Blueprint,
  ContentBankEntry,
  CreatorInput,
  Quiz,
  TopicProposal,
} from "../blueprint/types";
import type { OrderRow } from "../db/types";
import { scrapeCreator } from "../scrape";
import {
  sendBuildDeclined,
  sendIdeasReady,
  sendPlanDelivered,
  sendSamplesReady,
} from "../email";
import { renderPlanPdf, sectionsForPdf } from "../pdf";

const db = () => supabaseAdmin();

async function updateBuild(buildId: string, patch: Record<string, unknown>) {
  const { error } = await db().from("builds").update(patch).eq("id", buildId);
  if (error) throw new Error(`builds update: ${error.message}`);
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

// ============================================================ blueprint.build
export const blueprintBuild = inngest.createFunction(
  {
    id: "blueprint-build",
    concurrency: { limit: 3 },
    retries: 2,
    triggers: [{ event: "build/requested" }],
  },
  async ({ event, step }) => {
    const { buildId, creatorId, handle, selfDescription, rebuildOfBuildId } =
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
      const scoped = createPipelineApi(usage);
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
        const scoped = createPipelineApi(usage);
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
            const scoped = createPipelineApi(usage);
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
            "None of the product angles we found were segmentable enough to personalize honestly."
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
    const skeleton = skeletonFor(durationDays);
    const voice = defaultVoice(audience.tone_notes);
    const criticResults: Record<string, unknown> = {};

    // ---- 4. knowledge pack + critic, ≤2 retries ------------------------------
    const pack = await step.run("knowledge", async () => {
      await updateBuild(buildId, { ...STAGE_STATUS, stage: "knowledge" });
      const usage = createUsageTracker();
      const scoped = createPipelineApi(usage);
      const attempts: unknown[] = [];
      let candidate = await scoped.buildKnowledgePack(topic, audience);
      for (let attempt = 0; attempt < 3; attempt++) {
        const critic = await scoped.knowledgeCritic(candidate);
        attempts.push(critic);
        if (critic.pass || attempt === 2) break;
        candidate = await scoped.buildKnowledgePack(topic, audience);
      }
      await addCost(buildId, usage.cost_usd);
      criticResults.knowledge = attempts;
      await updateBuild(buildId, { critic_results: criticResults });
      return candidate;
    });

    // ---- 5-8. quiz → briefs → render → swap, with one full retry on swap fail
    let quiz: Quiz | null = null;
    let contentBank: Record<string, ContentBankEntry> = {};
    let renders: Record<string, Record<string, string>> = {};
    let sampleArchetypes: string[] = [];
    let swapPassed = false;

    for (let attempt = 1; attempt <= 2 && !swapPassed; attempt++) {
      // quiz + structural validation, ≤2 regenerations
      const quizResult = await step.run(`quiz-${attempt}`, async () => {
        await updateBuild(buildId, { ...STAGE_STATUS, stage: "quiz" });
        const usage = createUsageTracker();
        const scoped = createPipelineApi(usage);
        let lastErrors: unknown[] = [];
        for (let qa = 0; qa < 3; qa++) {
          const candidate = await scoped.designQuiz(pack, audience, skeleton);
          const draft: Blueprint = {
            blueprint_id: `bp_${creatorId}`,
            blueprint_version: 0,
            status: "draft",
            creator: { handle, audience_card: audience },
            product: {
              topic_title: topic.topic_title,
              promise: topic.promise,
              duration_days: durationDays,
              price_usd: 27,
            },
            knowledge_pack: pack,
            quiz: candidate,
            output: { skeleton, content_bank: {}, voice, personalization_tokens: [] },
            safety: { domain_risk_tier: "low", disclaimers: [], banned_claims: [], escalation_triggers: [] },
            eval: {
              rubric: RUBRIC,
              swap_test: { min_divergence_pct: MIN_DIVERGENCE },
              thresholds: { min_weighted_score: MIN_SCORE },
            },
          };
          const structural = validateBlueprint(draft);
          if (!structural.errors.length) {
            const critic = await scoped.quizCritic(candidate, pack, audience.audience_words ?? []);
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

      // briefs — full content bank: every (section, archetype) pair incl. fallback
      const archetypeIds = [
        ...quiz.archetype_rules.map((r) => r.id),
        quiz.fallback_archetype,
      ].filter((v, i, a) => v && a.indexOf(v) === i);

      contentBank = {};
      for (const archetypeId of archetypeIds) {
        const bank = await step.run(`briefs-${attempt}-${archetypeId}`, async () => {
          await updateBuild(buildId, { ...STAGE_STATUS, stage: "briefs" });
          const usage = createUsageTracker();
          const scoped = createPipelineApi(usage);
          const rule = quiz!.archetype_rules.find((r) => r.id === archetypeId);
          const rationale = rule?.archetype_rationale ?? "General starting point for unmatched buyers.";
          const earlier: Record<string, string> = {};
          const entries: Record<string, ContentBankEntry> = {};
          for (const section of skeleton) {
            const entry = await scoped.writeBrief({
              knowledgePack: pack,
              archetype: archetypeId,
              rationale,
              section,
              voice,
              earlier,
            });
            entries[`${section.id}::${archetypeId}`] = entry;
            earlier[section.id] = entry.brief;
          }
          await addCost(buildId, usage.cost_usd);
          return entries;
        });
        Object.assign(contentBank, bank);
      }

      // render evaluation samples: up to 4 archetypes × EVAL_SECTIONS
      sampleArchetypes = quiz.archetype_rules
        .slice()
        .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
        .slice(0, 4)
        .map((r) => r.id);

      renders = await step.run(`render-${attempt}`, async () => {
        await updateBuild(buildId, { ...STAGE_STATUS, stage: "render" });
        const usage = createUsageTracker();
        const scoped = createPipelineApi(usage);
        const out: Record<string, Record<string, string>> = {};
        for (const archetypeId of sampleArchetypes) {
          out[archetypeId] = {};
          let prev = "";
          const label = quiz!.archetype_rules.find((r) => r.id === archetypeId)?.label ?? archetypeId;
          for (const section of skeleton.filter((s) => EVAL_SECTIONS.includes(s.id))) {
            const entry = contentBank[`${section.id}::${archetypeId}`];
            const mechanisms = pack.mechanisms.filter((m) => entry.mechanism_refs?.includes(m.id));
            const prose = await scoped.renderSection({
              entry,
              mechanisms,
              buyer: { situation: label },
              voice,
              section,
              previousEnding: prev.slice(-200),
            });
            out[archetypeId][section.id] = prose;
            prev = prose;
          }
        }
        await addCost(buildId, usage.cost_usd);
        return out;
      });

      // swap test — deterministic and free, runs before the output critic
      const swap = await step.run(`swap-${attempt}`, async () => {
        await updateBuild(buildId, { ...STAGE_STATUS, stage: "swap_test" });
        const pairs: [string, string][] = [];
        for (let i = 0; i + 1 < sampleArchetypes.length; i += 2) {
          pairs.push([sampleArchetypes[i], sampleArchetypes[i + 1]]);
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
            error: "Archetypes are not materially different — quiz regeneration did not fix it.",
            completed_at: new Date().toISOString(),
          })
        );
        return { failed: "swap_test" };
      }
    }

    // ---- 9. output critic + quality gate -------------------------------------
    const gate = await step.run("critique", async () => {
      await updateBuild(buildId, { ...STAGE_STATUS, stage: "critique" });
      const usage = createUsageTracker();
      const scoped = createPipelineApi(usage);
      const scored: { archetype: string; section: string; weighted: number; scores: unknown }[] = [];
      for (const archetypeId of sampleArchetypes) {
        for (const sectionId of EVAL_SECTIONS) {
          const r = await scoped.outputCritic(archetypeId, renders[archetypeId][sectionId], RUBRIC);
          scored.push({
            archetype: archetypeId,
            section: sectionId,
            weighted: r.weighted ?? 0,
            scores: r.scores,
          });
        }
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

    // ---- 10. persist blueprint + samples, pause for creator approval ---------
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
        archetype_version: "transformation_plan_v1",
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
          price_usd: 27,
          format: "pdf",
        },
        knowledge_pack: pack,
        quiz: quiz!,
        output: {
          skeleton,
          content_bank: contentBank,
          personalization_tokens: [],
          voice,
        },
        safety: { domain_risk_tier: "low", disclaimers: [], banned_claims: [], escalation_triggers: [] },
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
          price_cents: 2700,
        })
        .select("id")
        .single();
      if (error) throw new Error(`blueprints insert: ${error.message}`);

      const sampleRows = sampleArchetypes.slice(0, 3).map((archetypeId) => ({
        blueprint_id: bpRow.id,
        archetype: archetypeId,
        archetype_label:
          quiz!.archetype_rules.find((r) => r.id === archetypeId)?.label ?? archetypeId,
        sections: renders[archetypeId],
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
        data: { buildId: newBuildId, creatorId, handle, rebuildOfBuildId: buildId },
      });
      return { rejected: true, rebuild: newBuildId };
    }

    // ---- 11. approval: freeze, version, publish -------------------------------
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

      const bp = bpRow.data as Blueprint;
      const resolved = resolveArchetype(bp, (order as OrderRow).quiz_answers);
      await db()
        .from("orders")
        .update({
          status: "generating",
          resolved_archetype: resolved.archetype,
          resolved_signals: resolved.signals,
        })
        .eq("id", orderId);
      return {
        order: order as OrderRow,
        blueprintRowId: bpRow.id as string,
        blueprint: bp,
        creatorName:
          (bpRow.creators?.display_name as string) ??
          (bpRow.creators?.handle as string) ??
          bp.creator.handle,
        resolved,
      };
    });

    const bp = ctx.blueprint;
    const archetypeRule = bp.quiz.archetype_rules.find((r) => r.id === ctx.resolved.archetype);
    const archetypeLabel = archetypeRule?.label ?? "Your starting point";

    // cache: identical blueprint version + archetype + answers = identical plan
    const cached = await step.run("cache-check", async () => {
      const { data: twins } = await db()
        .from("orders")
        .select("id, outputs(sections)")
        .eq("blueprint_id", ctx.order.blueprint_id)
        .eq("blueprint_version", ctx.order.blueprint_version)
        .eq("resolved_archetype", ctx.resolved.archetype)
        .eq("status", "delivered")
        .neq("id", orderId)
        .limit(10);
      const answersKey = JSON.stringify(ctx.order.quiz_answers);
      type Twin = { id: string; outputs: { sections: unknown } | { sections: unknown }[] | null };
      for (const t of (twins ?? []) as Twin[]) {
        const { data: twin } = await db()
          .from("orders")
          .select("quiz_answers")
          .eq("id", t.id)
          .single();
        if (JSON.stringify(twin?.quiz_answers) === answersKey) {
          const sections = Array.isArray(t.outputs) ? t.outputs[0]?.sections : t.outputs?.sections;
          if (sections) return sections as Record<string, string>;
        }
      }
      return null;
    });

    const t0 = Date.now();
    let sections: Record<string, string>;

    if (cached) {
      sections = cached;
    } else {
      // readable answers for the writer
      const readableAnswers: Record<string, string> = {};
      for (const q of bp.quiz.questions) {
        const given = ctx.order.quiz_answers[q.id];
        const values = Array.isArray(given) ? given : [given];
        const labels = values
          .map((v) => q.options.find((o) => o.value === v)?.label)
          .filter(Boolean);
        if (labels.length) readableAnswers[q.question] = labels.join("; ");
      }
      const buyer = {
        situation: archetypeLabel,
        archetype_rationale: archetypeRule?.archetype_rationale,
        signals: ctx.resolved.signals,
        quiz_answers: readableAnswers,
      };

      // all sections in parallel — each its own retriable step
      const skeleton = bp.output.skeleton.filter((s) => !s.conditional);
      const rendered = await Promise.all(
        skeleton.map((section) =>
          step.run(`render-${section.id}`, async () => {
            const usage = createUsageTracker();
            const scoped = createPipelineApi(usage);
            const entry =
              bp.output.content_bank[`${section.id}::${ctx.resolved.archetype}`] ??
              bp.output.content_bank[`${section.id}::${bp.quiz.fallback_archetype}`];
            if (!entry) throw new Error(`No brief for ${section.id}::${ctx.resolved.archetype}`);
            const mechanisms = bp.knowledge_pack.mechanisms.filter((m) =>
              entry.mechanism_refs?.includes(m.id)
            );
            const prose = await scoped.renderSection({
              entry,
              mechanisms,
              buyer,
              voice: bp.output.voice,
              section,
              previousEnding: "",
            });
            return { id: section.id, prose };
          })
        )
      );
      sections = Object.fromEntries(rendered.map((r) => [r.id, r.prose]));
    }

    const outputId = await step.run("assemble", async () => {
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
          sections,
          generation_ms: Date.now() - t0,
        })
        .select("id")
        .single();
      if (error) throw new Error(`outputs insert: ${error.message}`);
      return data.id as string;
    });

    await step.run("pdf", async () => {
      const pdf = await renderPlanPdf({
        topicTitle: bp.product.topic_title,
        creatorName: ctx.creatorName,
        archetypeLabel,
        archetypeNote: archetypeRule?.archetype_rationale,
        sections: sectionsForPdf(bp.output.skeleton, sections),
      });
      const path = `orders/${orderId}.pdf`;
      const { error } = await db()
        .storage.from("pdfs")
        .upload(path, pdf, { contentType: "application/pdf", upsert: true });
      if (error) throw new Error(`pdf upload: ${error.message}`);
      await db().from("outputs").update({ pdf_path: path }).eq("id", outputId);
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

export const functions = [blueprintBuild, planGenerate];
