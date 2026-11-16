// The Groq client and the notice prompts (D81), with a stand-in fetch: no request leaves the machine.
import { describe, expect, it } from "vitest";

import { DO_NOT_TRANSLATE } from "./glossary";
import { ChatError, GROQ_CHAT_URL, groqChat, TEMPERATURE } from "./groq";
import {
  improveSystem,
  improveText,
  plainText,
  TRANSLATE_SYSTEM,
  translateText,
} from "./notice-writing";

type Answer = (init: RequestInit | undefined) => Response | Promise<Response>;

const ok =
  (content: string, finish = "stop"): Answer =>
  () =>
    Response.json({ choices: [{ finish_reason: finish, message: { content } }] });
const status =
  (code: number): Answer =>
  () =>
    new Response("{}", { status: code });
/** Never answers; rejects when the request's signal aborts, as fetch does. */
const hang: Answer = (init) =>
  new Promise((_, reject) =>
    init?.signal?.addEventListener("abort", () => reject(init.signal?.reason)),
  );

/** A fetch that answers in turn and keeps every request. */
function fake(...answers: Answer[]) {
  const calls: { url: string; headers: Headers; body: Record<string, unknown> }[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    calls.push({
      url: String(input),
      headers: new Headers(init?.headers),
      body: JSON.parse(String(init?.body)) as Record<string, unknown>,
    });
    const answer = answers[calls.length - 1];
    if (!answer) throw new Error("unexpected request");
    return answer(init);
  };
  return { calls, fetcher };
}

const TEXT = "Rally at 18:00 ST, [OGs]Mudkip leads. Bubble up before KvK!";

describe("groqChat (D81)", () => {
  it("sends the key, the first model, temperature 0.2 and two messages: the prompt and the text", async () => {
    const { calls, fetcher } = fake(ok("Rally às 18:00 ST"));
    const out = await translateText(groqChat("gsk_test", fetcher), "en", "pt-BR", TEXT);
    expect(out).toBe("Rally às 18:00 ST");
    expect(calls).toHaveLength(1);
    const [call] = calls;
    expect(call?.url).toBe(GROQ_CHAT_URL);
    expect(call?.headers.get("authorization")).toBe("Bearer gsk_test");
    expect(Object.keys(call?.body ?? {}).sort()).toEqual([
      "max_completion_tokens",
      "messages",
      "model",
      "reasoning_effort",
      "temperature",
    ]);
    expect(call?.body).toMatchObject({ model: "openai/gpt-oss-120b", temperature: TEMPERATURE });
    expect(TEMPERATURE).toBe(0.2);
    expect(call?.body.messages).toEqual([
      { role: "system", content: TRANSLATE_SYSTEM },
      {
        role: "user",
        content: `Translate from English to Brazilian Portuguese (pt-BR):\n\n${TEXT}`,
      },
    ]);
  });

  it("asks the second model after a 429, a 5xx or a cut answer", async () => {
    for (const first of [status(429), status(503), ok("Rally", "length")]) {
      const { calls, fetcher } = fake(first, ok("Ralliement à 18:00 ST"));
      const out = await translateText(groqChat("gsk_test", fetcher), "en", "fr", TEXT);
      expect(out).toBe("Ralliement à 18:00 ST");
      expect(calls.map((c) => c.body.model)).toEqual(["openai/gpt-oss-120b", "qwen/qwen3.8-27b"]);
    }
    const { fetcher } = fake(status(429), status(429));
    await expect(translateText(groqChat("gsk_test", fetcher), "en", "fr", TEXT)).rejects.toEqual(
      new ChatError("busy"),
    );
  });

  it("times out each model and fails with a timeout when both do", async () => {
    const late = fake(hang, ok("Rally"));
    expect(await translateText(groqChat("gsk_test", late.fetcher, 20), "en", "fr", TEXT)).toBe(
      "Rally",
    );
    const { fetcher } = fake(hang, hang);
    const error = await translateText(groqChat("gsk_test", fetcher, 20), "en", "fr", TEXT).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(ChatError);
    expect((error as ChatError).kind).toBe("timeout");
  });
});

describe("the notice prompts (D81)", () => {
  it("carry the do-not-translate list; Improve writing keeps the language and adds no blame", async () => {
    for (const term of [
      "AD",
      "KvK",
      "EB",
      "Squad",
      "Sanctuary",
      "Coachman",
      "VIP",
      "Guardian",
      "ST",
    ])
      expect(DO_NOT_TRANSLATE).toContain(term);
    expect(TRANSLATE_SYSTEM).toContain(DO_NOT_TRANSLATE.join(", "));
    expect(TRANSLATE_SYSTEM).toContain("Brazilian Portuguese");
    expect(TRANSLATE_SYSTEM).toContain("no-break space");
    const system = improveSystem(1000);
    expect(system).toContain(DO_NOT_TRANSLATE.join(", "));
    expect(system).toContain("under 1000 characters");
    expect(system).toContain("never add blame, threats, punishment");
    const { calls, fetcher } = fake(ok("Obrigado a todos!"));
    await improveText(groqChat("gsk_test", fetcher), "pt-BR", "warmer", "Rally às 18:00.", 1000);
    expect(calls[0]?.body.messages).toEqual([
      { role: "system", content: system },
      {
        role: "user",
        content:
          "Rewrite this Brazilian Portuguese (pt-BR) text. Warmer: cozy and welcoming, like a friend who helps lead the alliance.\n\nRally às 18:00.",
      },
    ]);
  });

  it("return plain text for the game: French keeps its no-break space, the others plain spaces", () => {
    // As gpt-oss-120b answered in the 11i e2e: narrow no-break spaces, non-breaking hyphens, Markdown breaks.
    const sent = "Salut OGs ! 3 h pour la contre‑attaque.  \nQuestions ?";
    expect(plainText(sent, "fr")).toBe("Salut OGs ! 3 h pour la contre-attaque.\nQuestions ?");
    expect(plainText("Squad 1 at 12:00 ST.  \nThanks", "en")).toBe("Squad 1 at 12:00 ST.\nThanks");
  });
});
