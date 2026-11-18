// Groq's OpenAI-compatible chat completions (D81), the model behind Translate and Improve writing. The
// first model answers; on any failure (429, 5xx, a timeout, an empty or cut answer) the second is asked
// once. The request carries only the system prompt and the officer's text; nothing is logged here.
// lib/app-context.ts makes the one instance, with GROQ_API_KEY, and the observer that sends each request's
// metadata to PostHog as `$ai_generation` (D115).
import { z } from "zod";

export const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";

/** In order: the bake-off's winner, then its runner-up (issue 305), each with the reasoning it was measured with. */
export const GROQ_MODELS = [
  { model: "openai/gpt-oss-120b", reasoning_effort: "low" },
  { model: "qwen/qwen3.8-27b", reasoning_effort: "none" },
] as const;

export const TEMPERATURE = 0.2;
/** Per model: a notice takes about a second; the free tier can queue. */
export const TIMEOUT_MS = 15_000;
/** Room for gpt-oss's reasoning plus a 1000-character notice. */
const MAX_TOKENS = 2_000;

export interface ChatRequest {
  system: string;
  user: string;
}

/** A second, harder look for one request: more reasoning and room on the first model (D81). */
export interface Retune {
  effort: "medium";
  maxTokens: number;
}

export interface ChatModel {
  complete(request: ChatRequest, retune?: Retune): Promise<string>;
}

/** timeout: no answer in time. busy: the free tier's limit (429). failed: anything else. */
export type ChatFailure = "timeout" | "busy" | "failed";

export class ChatError extends Error {
  constructor(readonly kind: ChatFailure) {
    super(`chat ${kind}`);
  }
}

/**
 * One request to Groq as LLM observability sees it (D115): no prompt and no answer, only the model, the
 * tokens Groq counted, the time, whether it was the second model, and the failure code.
 */
export interface Generation {
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number;
  fallback: boolean;
  error: ChatFailure | null;
}

const answer = z.object({
  choices: z
    .array(z.object({ finish_reason: z.string(), message: z.object({ content: z.string() }) }))
    .min(1),
  usage: z.object({ prompt_tokens: z.number(), completion_tokens: z.number() }).optional(),
});

type Usage = Pick<Generation, "inputTokens" | "outputTokens">;
const NO_USAGE: Usage = { inputTokens: null, outputTokens: null };

/** The answer's text, or why there is none. A cut answer (finish_reason "length") counts as none. */
async function read(response: Response, usage: { value: Usage }): Promise<string> {
  if (response.status === 429) throw new ChatError("busy");
  if (!response.ok) throw new ChatError("failed");
  const parsed = answer.safeParse(await response.json());
  const counted = parsed.success ? parsed.data.usage : undefined;
  if (counted) {
    usage.value = { inputTokens: counted.prompt_tokens, outputTokens: counted.completion_tokens };
  }
  const first = parsed.success ? parsed.data.choices[0] : undefined;
  const text = first?.message.content.trim() ?? "";
  if (first?.finish_reason !== "stop" || text === "") throw new ChatError("failed");
  return text;
}

/**
 * `observe`: gets every request of one `complete` (one, or two with the fallback) once it has an answer;
 * the answer waits for it. It never sees the key, the prompt or the text.
 */
export function groqChat(
  apiKey: string,
  fetcher: typeof fetch,
  timeoutMs = TIMEOUT_MS,
  observe?: (generations: Generation[]) => Promise<void>,
): ChatModel {
  async function ask(
    choice: (typeof GROQ_MODELS)[number],
    request: ChatRequest,
    usage: { value: Usage },
    retune?: Retune,
  ): Promise<string> {
    const body = {
      ...choice,
      ...(retune && { reasoning_effort: retune.effort }),
      temperature: TEMPERATURE,
      max_completion_tokens: retune?.maxTokens ?? MAX_TOKENS,
      messages: [
        { role: "system", content: request.system },
        { role: "user", content: request.user },
      ],
    };
    try {
      const response = await fetcher(GROQ_CHAT_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
      return await read(response, usage);
    } catch (error) {
      if (error instanceof ChatError) throw error;
      const timedOut = error instanceof Error && error.name === "TimeoutError";
      throw new ChatError(timedOut ? "timeout" : "failed");
    }
  }
  /** `ask`, timed, with its metadata added to `log`. */
  async function timed(
    log: Generation[],
    choice: (typeof GROQ_MODELS)[number],
    request: ChatRequest,
    retune?: Retune,
  ): Promise<string> {
    const started = performance.now();
    const usage = { value: NO_USAGE };
    const record = (error: ChatFailure | null) =>
      log.push({
        model: choice.model,
        ...usage.value,
        latencyMs: Math.round(performance.now() - started),
        fallback: choice !== first,
        error,
      });
    try {
      const text = await ask(choice, request, usage, retune);
      record(null);
      return text;
    } catch (error) {
      record(error instanceof ChatError ? error.kind : "failed");
      throw error;
    }
  }
  const [first, second] = GROQ_MODELS;
  return {
    // A retune applies to the first model only; the second keeps the settings it was measured with.
    complete: async (request, retune) => {
      const log: Generation[] = [];
      try {
        return await timed(log, first, request, retune).catch(() => timed(log, second, request));
      } finally {
        await observe?.(log);
      }
    },
  };
}
