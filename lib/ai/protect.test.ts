// The alliance glossary in a request (#832, D81 amendment), with a stand-in model: no request leaves the
// machine. Invented words and text.
import { describe, expect, it } from "vitest";

import { ChatError, type ChatModel, type ChatRequest } from "./groq";
import { fitText, improveText, translateText } from "./notice-writing";
import { placeholdersIntact, protectWords, restoreWords } from "./protect";

const WORDS = ["[ZZZ]", "Elixir Scramble"];
const TEXT = "[ZZZ] gather before the Elixir Scramble starts, thank you all!";

/** A model that answers with `reply(request)` and keeps every request. */
function model(reply: (request: ChatRequest) => string) {
  const requests: ChatRequest[] = [];
  const chat: ChatModel = {
    complete: async (request) => {
      requests.push(request);
      return reply(request);
    },
  };
  return { chat, requests };
}

describe("the alliance glossary in a request", () => {
  it("lists the words in the system prompt and puts them back as written after the answer", async () => {
    const { chat, requests } = model((request) => {
      expect(request.user).not.toContain("[ZZZ]");
      expect(request.user).not.toContain("Elixir Scramble");
      return "{G1} reunam-se antes de {G2} começar, obrigado a todos!";
    });
    const done = await translateText(chat, "en", "pt-BR", TEXT, 1000, WORDS);
    expect(done.text).toBe("[ZZZ] reunam-se antes de Elixir Scramble começar, obrigado a todos!");
    const system = requests[0]?.system ?? "";
    expect(system).toContain('"[ZZZ]", "Elixir Scramble"');
    // Without a glossary nothing about it is asked.
    const plain = model(() => "Reunam-se antes do início, obrigado a todos!");
    await translateText(plain.chat, "en", "pt-BR", "Gather before the start, thank you all!");
    expect(plain.requests[0]?.system).not.toContain("alliance's own words");
  });

  it("keeps a word in the case it was written, and whole words only", () => {
    const guard = protectWords("elixir scramble and Elixir Scrambles", WORDS);
    expect(guard.text).toBe("{G1} and Elixir Scrambles");
    expect(restoreWords("{G1} e outros", guard)).toBe("elixir scramble e outros");
  });

  it("treats an answer that dropped a placeholder as a failure, so the text stays as it is", async () => {
    const dropped = () => "[ZZZ] reunam-se antes de Elixir Scramble começar!";
    await expect(
      translateText(model(dropped).chat, "en", "pt-BR", TEXT, 1000, WORDS),
    ).rejects.toEqual(new ChatError("failed"));
    await expect(
      improveText(model(dropped).chat, "en", "warmer", TEXT, 1000, WORDS),
    ).rejects.toEqual(new ChatError("failed"));
    // Shorten counts it as a try that did not fit: both tries lost it, so no draft.
    const fit = model(dropped);
    expect(await fitText(fit.chat, "en", TEXT, 1000, (t) => t.length, WORDS)).toBeNull();
    expect(fit.requests).toHaveLength(2);
    const two = protectWords("[ZZZ] and Elixir Scramble", WORDS);
    expect(placeholdersIntact("{G1} and {G2}", two)).toBe(true);
    expect(placeholdersIntact("{G1}", two)).toBe(false);
  });

  it("still translates text that already holds a {G1}, with or without a glossary", async () => {
    const text = "Use {G1} here, thank you!";
    const empty = model(() => "Use {G1} aqui, obrigado!");
    expect((await translateText(empty.chat, "en", "pt-BR", text, 1000, [])).text).toBe(
      "Use {G1} aqui, obrigado!",
    );
    // With a glossary, a {G1} the text already has is not taken for the glossary's placeholder.
    const full = model(() => "{G1} {L1} aqui");
    const done = await translateText(full.chat, "en", "pt-BR", "[ZZZ] {G1} here", 1000, WORDS);
    expect(full.requests[0]?.user).toContain("{G1} {L1} here");
    expect(done.text).toBe("[ZZZ] {G1} aqui");
  });
});
