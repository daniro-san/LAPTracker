import { describe, expect, it } from "vitest";

import { ChatError, type ChatModel, type ChatRequest } from "../ai/groq";
import type { TranslationJob } from "./discord-translate";
import { runTranslation, type TranslationDeps } from "./discord-translate-run";
import { mask, type Picker } from "./translate-message";

// Invented server, people and messages.
const NOW = new Date("2026-11-17T20:00:00Z");
const GUILD = "1544808864262914060";
const CHANNEL = "1600000000000000001";
const MESSAGE = "1600000000000000055";
const ASKER = "700000000000000001";
const LINK = `https://discord.com/channels/${GUILD}/${CHANNEL}/${MESSAGE}`;

const picker = (where: "thread" | "channel"): Picker => ({
  messageId: MESSAGE,
  userId: ASKER,
  from: "en",
  to: ["pt-BR", "fr"],
  where,
});

/** A translator that answers each language with an invented line, {1} kept; French can be made to fail. */
const model = (frenchFails = false): ChatModel => ({
  complete: async (request: ChatRequest) => {
    if (request.user.includes("to French")) {
      if (frenchFails) throw new ChatError("busy");
      return "Le rally {1} est à 18:00.";
    }
    return "O rally {1} é às 18:00.";
  },
});

/** Discord, recorded: `thread` is what opening a thread answers; bot posts fail after `threadPosts`. */
function discordStub(thread: Response, threadPosts = Infinity) {
  const calls: { method: string; path: string; bot: boolean; body: Record<string, unknown> }[] = [];
  let posted = 0;
  const fetcher: typeof fetch = async (url, init) => {
    const path = String(url).replace("https://discord.test/api", "");
    const bot = new Headers(init?.headers).get("authorization")?.startsWith("Bot ") ?? false;
    calls.push({ method: init?.method ?? "GET", path, bot, body: JSON.parse(String(init?.body)) });
    if (path.endsWith("/threads")) return thread.clone();
    if (bot && (posted += 1) > threadPosts) return Response.json({ code: 50013 }, { status: 403 });
    return Response.json({ id: "1" });
  };
  return { calls, fetcher };
}

const job = (
  where: "thread" | "channel",
  mode: "me" | "everyone" = "everyone",
): TranslationJob => ({
  mode,
  language: "en",
  from: "en",
  to: mode === "me" ? ["fr"] : ["pt-BR", "fr"],
  ...mask("The rally <#1600000000000000009> is at 18:00."),
  webhook: { applicationId: "900", token: "itok" },
  userId: ASKER,
  ...(mode === "everyone" && {
    post: {
      where,
      channelId: CHANNEL,
      link: LINK,
      picker: picker(where),
      places: ["thread", "channel"],
    },
  }),
});

const deps = (
  fetcher: typeof fetch,
  botToken?: string,
  ai: ChatModel | null = model(),
): TranslationDeps => ({
  ai,
  fetch: fetcher,
  discordBase: "https://discord.test/api",
  botToken,
  now: () => NOW,
});
const created = () => Response.json({ id: "1700000000000000001" }, { status: 201 });
const lastLine = (calls: { method: string; body: Record<string, unknown> }[]) =>
  calls.filter((c) => c.method === "PATCH").at(-1)?.body.content;

describe("posting for everyone: a thread or the channel", () => {
  it("opens a thread on the message and posts each language in it as the bot, saying who asked", async () => {
    const { calls, fetcher } = discordStub(created());
    await runTranslation(deps(fetcher, "bot-token-for-tests"), job("thread"));
    expect(calls.find((c) => c.path.endsWith("/threads"))).toMatchObject({
      path: `/channels/${CHANNEL}/messages/${MESSAGE}/threads`,
      bot: true,
      body: { name: "Translation", auto_archive_duration: 1440 },
    });
    const posts = calls.filter((c) => c.path === "/channels/1700000000000000001/messages");
    expect(posts.map((p) => p.body.content)).toEqual([
      `-# Asked by <@${ASKER}>\n**🇧🇷 Português**\nO rally <#1600000000000000009> é às 18:00.`,
      "**🇫🇷 Français**\nLe rally <#1600000000000000009> est à 18:00.",
    ]);
    expect(
      posts.every((p) => p.bot && JSON.stringify(p.body.allowed_mentions) === '{"parse":[]}'),
    ).toBe(true);
    expect(lastLine(calls)).toBe("Posted in the message’s thread.");
  });

  it("posts in the thread the message already has", async () => {
    const exists = Response.json({ code: 160004 }, { status: 400 });
    const { calls, fetcher } = discordStub(exists);
    await runTranslation(deps(fetcher, "bot-token-for-tests"), job("thread"));
    expect(calls.filter((c) => c.path === `/channels/${MESSAGE}/messages`)).toHaveLength(2);
  });

  it("falls back to the channel, and says so, when the bot cannot open a thread", async () => {
    const { calls, fetcher } = discordStub(Response.json({ code: 50013 }, { status: 403 }));
    await runTranslation(deps(fetcher, "bot-token-for-tests"), job("thread"));
    const followUp = calls.find((c) => c.method === "POST" && c.path === "/webhooks/900/itok");
    expect(followUp?.body.embeds).toHaveLength(2);
    expect(lastLine(calls)).toBe("Posted in the channel: the bot can’t open threads here.");
  });

  it("posts only the languages the thread did not take in the channel, and says exactly that", async () => {
    const { calls, fetcher } = discordStub(created(), 1);
    await runTranslation(deps(fetcher, "bot-token-for-tests"), job("thread"));
    const followUp = calls.find((c) => c.path === "/webhooks/900/itok");
    expect(followUp?.body.embeds).toEqual([
      { title: "🇫🇷 Français", description: "Le rally <#1600000000000000009> est à 18:00." },
    ]);
    expect(lastLine(calls)).toBe(
      "Posted in the thread: 🇧🇷 Português. The bot could not post the rest in the thread. In the channel: 🇫🇷 Français.",
    );
  });

  it("posts in the channel with the message's link and who asked, mentions off", async () => {
    const { calls, fetcher } = discordStub(created());
    await runTranslation(deps(fetcher, undefined), job("channel"));
    expect(calls.some((c) => c.path.includes("/threads") || c.bot)).toBe(false);
    expect(calls.find((c) => c.path === "/webhooks/900/itok")?.body).toMatchObject({
      content: `${LINK}\n-# Asked by <@${ASKER}>`,
      embeds: [{ title: "🇧🇷 Português" }, { title: "🇫🇷 Français" }],
      allowed_mentions: { parse: [] },
    });
    expect(lastLine(calls)).toBe("Posted in the channel.");
  });

  it("names a language that failed and why, beside the ones posted", async () => {
    const { calls, fetcher } = discordStub(created());
    await runTranslation(deps(fetcher, "bot-token-for-tests", model(true)), job("thread"));
    expect(lastLine(calls)).toBe(
      "Posted in the message’s thread.\nNot translated: 🇫🇷 Français. The translator is busy. Try again in a minute.",
    );
  });
});

describe("Translate for me, after the answer", () => {
  it("edits the private reply with the translation, or says Translate is off without the key", async () => {
    const { calls, fetcher } = discordStub(created());
    await runTranslation(deps(fetcher), job("channel", "me"));
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      method: "PATCH",
      path: "/webhooks/900/itok/messages/@original",
      body: {
        content: "",
        embeds: [
          {
            title: "🇫🇷 Français",
            description: "Le rally <#1600000000000000009> est à 18:00.",
            footer: { text: "Other language:" },
          },
        ],
      },
    });
    const off = discordStub(created());
    await runTranslation(deps(off.fetcher, undefined, null), job("channel", "me"));
    expect(lastLine(off.calls)).toBe("Translate isn’t available yet. Ask the site owner.");
  });
});

describe("Translate for me: the other languages' buttons", () => {
  const labels = (body: Record<string, unknown> | undefined) =>
    (body?.components as { components: { label: string }[] }[]).flatMap((r) =>
      r.components.map((c) => c.label),
    );

  it("offers every language but the one shown, each a button only the asker may press", async () => {
    const { calls, fetcher } = discordStub(created());
    await runTranslation(deps(fetcher), job("channel", "me"));
    expect(labels(calls[0]?.body)).toEqual(["English", "Português"]);
    expect(JSON.stringify(calls[0]?.body.components)).toContain(`:${ASKER}"`);
  });

  it("edits the same reply with the pressed language, its own button left out", async () => {
    const { calls, fetcher } = discordStub(created());
    const pressed: TranslationJob = { ...job("channel", "me"), to: ["pt-BR"], pressed: true };
    await runTranslation(deps(fetcher), pressed);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      path: "/webhooks/900/itok/messages/@original",
      body: {
        content: "",
        embeds: [
          { title: "🇧🇷 Português", description: "O rally <#1600000000000000009> é às 18:00." },
        ],
        allowed_mentions: { parse: [] },
      },
    });
    expect(labels(calls[0]?.body)).toEqual(["English", "Français"]);
  });
});
