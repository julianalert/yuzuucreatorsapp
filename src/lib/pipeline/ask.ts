/**
 * Model call layer. Ported from harness ask() — same fence-stripping and
 * brace-matching JSON recovery. Extended with provider routing:
 *
 *   - Anthropic (Claude) for content generation (build stages, runtime writer)
 *   - OpenAI (mini model) for system/eval calls (extraction, critics)
 *
 * Routing is per-role and overridable via env so any stage can be flipped
 * back to the harness's all-Claude assignment.
 */

export type ModelRole = "extract" | "build" | "critic" | "writer";

interface ModelSpec {
  provider: "anthropic" | "openai";
  model: string;
}

function roleSpec(role: ModelRole): ModelSpec {
  const env = process.env[`PIPELINE_MODEL_${role.toUpperCase()}`];
  if (env) {
    // format: "anthropic:claude-opus-4-6" or "openai:gpt-5-mini"
    const [provider, ...rest] = env.split(":");
    return { provider: provider as ModelSpec["provider"], model: rest.join(":") };
  }
  const defaults: Record<ModelRole, ModelSpec> = {
    extract: { provider: "openai", model: "gpt-5-mini" },
    build: { provider: "anthropic", model: "claude-sonnet-5" },
    critic: { provider: "openai", model: "gpt-5-mini" },
    writer: { provider: "anthropic", model: "claude-sonnet-5" },
  };
  return defaults[role];
}

// Rough $/1M tokens. Update when pricing changes.
const PRICING: Record<string, { input: number; output: number }> = {
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-opus-4-6": { input: 5, output: 25 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "gpt-5-mini": { input: 0.25, output: 2 },
};

export interface Usage {
  calls: number;
  input: number;
  output: number;
  cost_usd: number;
}

/** Per-run usage tracker so concurrent builds don't share module state. */
export function createUsageTracker(): Usage {
  return { calls: 0, input: 0, output: 0, cost_usd: 0 };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
let _anthropic: any;
let _openai: any;

async function anthropicClient() {
  if (_anthropic) return _anthropic;
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  _anthropic = new Anthropic();
  return _anthropic;
}

async function openaiClient() {
  if (_openai) return _openai;
  const { default: OpenAI } = await import("openai");
  _openai = new OpenAI();
  return _openai;
}

export function assertPipelineEnabled() {
  if (process.env.PIPELINE_KILL_SWITCH === "true") {
    throw new Error("Pipeline kill switch is on (PIPELINE_KILL_SWITCH=true).");
  }
}

/** Same JSON recovery as the harness: strip fences, then brace-match. */
export function parseModelJson(text: string): unknown {
  const clean = text.replace(/^```(?:json)?\s*/m, "").replace(/```\s*$/m, "").trim();
  try {
    return JSON.parse(clean);
  } catch {
    const start = clean.indexOf("{");
    const end = clean.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("No JSON in response: " + clean.slice(0, 300));
    return JSON.parse(clean.slice(start, end + 1));
  }
}

export interface AskOptions {
  json?: boolean;
  maxTokens?: number;
  usage?: Usage;
}

export async function ask(role: ModelRole, prompt: string, opts: AskOptions = {}): Promise<any> {
  assertPipelineEnabled();
  const { json = true, maxTokens = 8000, usage } = opts;
  const spec = roleSpec(role);
  let text: string;
  let inputTokens = 0;
  let outputTokens = 0;

  if (spec.provider === "anthropic") {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not set");
    const client = await anthropicClient();
    const res = await client.messages.create({
      model: spec.model,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    });
    inputTokens = res.usage.input_tokens;
    outputTokens = res.usage.output_tokens;
    text = res.content
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("\n");
  } else {
    if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not set");
    const client = await openaiClient();
    const res = await client.chat.completions.create({
      model: spec.model,
      max_completion_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    });
    inputTokens = res.usage?.prompt_tokens ?? 0;
    outputTokens = res.usage?.completion_tokens ?? 0;
    text = res.choices[0]?.message?.content ?? "";
  }

  if (usage) {
    const price = PRICING[spec.model] ?? { input: 3, output: 15 };
    usage.calls++;
    usage.input += inputTokens;
    usage.output += outputTokens;
    usage.cost_usd += (inputTokens / 1e6) * price.input + (outputTokens / 1e6) * price.output;
  }

  if (!json) return text;
  return parseModelJson(text);
}
