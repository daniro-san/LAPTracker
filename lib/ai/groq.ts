// Groq's OpenAI-compatible chat completions (D81), the model behind Translate and Improve writing. The
// first model answers; on any failure (429, 5xx, a timeout, an empty or cut answer) the second is asked
// once. The request carries only the system prompt and the officer's text; nothing is logged here.
// lib/app-context.ts makes the one instance, with GROQ_API_KEY.
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

const answer = z.object({
  choices: z
    .array(z.object({ finish_reason: z.string(), message: z.object({ content: z.string() }) }))
    .min(1),
});

/** The answer's text, or why there is none. A cut answer (finish_reason "length") counts as none. */
async function read(response: Response): Promise<string> {
  if (response.status === 429) throw new ChatError("busy");
  if (!response.ok) throw new ChatError("failed");
  const parsed = answer.safeParse(await response.json());
  const first = parsed.success ? parsed.data.choices[0] : undefined;
  const text = first?.message.content.trim() ?? "";
  if (first?.finish_reason !== "stop" || text === "") throw new ChatError("failed");
  return text;
}

export function groqChat(apiKey: string, fetcher: typeof fetch, timeoutMs = TIMEOUT_MS): ChatModel {
  async function ask(
    choice: (typeof GROQ_MODELS)[number],
    request: ChatRequest,
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
      return await read(response);
    } catch (error) {
      if (error instanceof ChatError) throw error;
      const timedOut = error instanceof Error && error.name === "TimeoutError";
      throw new ChatError(timedOut ? "timeout" : "failed");
    }
  }
  const [first, second] = GROQ_MODELS;
  return {
    // A retune applies to the first model only; the second keeps the settings it was measured with.
    complete: (request, retune) => ask(first, request, retune).catch(() => ask(second, request)),
  };
}
