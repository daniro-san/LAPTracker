import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { ChatModel, ChatRequest } from "../ai/groq";
import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { saveWorkspace } from "../repo/workspaces";
import {
  TRANSLATE_PER_MINUTE,
  translateCommand,
  translateComponent,
  type TranslateInput,
  type TranslationJob,
} from "./discord-translate";
import { runTranslation, type TranslationDeps } from "./discord-translate-run";
import { guessLanguage, mask, pickerId, unmask, type Picker } from "./translate-message";

// Invented server, people and messages.
const NOW = new Date("2026-11-17T20:00:00Z");
const GUILD = "1544808864262914060";
const CHANNEL = "1600000000000000001";
const MESSAGE = "1600000000000000055";
const ASKER = "700000000000000001";
const ENGLISH = "Hello everyone, the rally is at 18:00 today. Please bring your troops!";

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  await saveWorkspace(db, {
    unionId: 67111155,
    slug: "ogs",
    discordGuildId: GUILD,
    leaderRoleIds: ["1571951836724990113"],
  });
});

const input = (over: Partial<TranslateInput> = {}): TranslateInput => ({
  guildId: GUILD,
  channelId: CHANNEL,
  userId: ASKER,
  locale: "en-US",
  webhook: { applicationId: "900", token: "itok" },
  threads: false,
  ...over,
});

const forMe = (content: string, over: Partial<TranslateInput> = {}) =>
  translateCommand(db, "me", input(over), { messageId: MESSAGE, content }, NOW);
const forEveryone = (content: string, over: Partial<TranslateInput> = {}) =>
  translateCommand(db, "everyone", input(over), { messageId: MESSAGE, content }, NOW);

describe("Translate for me: the asker's Discord language (D101)", () => {
  it("maps pt-BR, fr and fr-CA to their language, and any other locale to English", async () => {
    const cases = [
      ["pt-BR", "pt-BR"],
      ["fr", "fr"],
      ["fr-CA", "fr"],
      ["en-GB", "en"],
      ["es-ES", "en"],
    ] as const;
    for (const [locale, language] of cases) {
      const text = "Bonjour à tous, le rally est à 18:00. Merci de venir avec vos troupes !";
      const answer = await forMe(language === "fr" ? ENGLISH : text, { locale });
      expect(answer.translation?.to, locale).toEqual([language]);
      expect(answer.translation?.language, locale).toBe(language);
    }
  });

  it("answers at once, without the translator, when the message is already in that language", async () => {
    const answer = await forMe(ENGLISH, { locale: "en-US" });
    expect(answer.translation).toBeUndefined();
    expect(answer.body).toEqual({
      type: 4,
      data: { content: "This message is already in your language.", flags: 64 },
    });
  });
});

describe("which languages are produced", () => {
  it("guesses English, Portuguese and French, and nothing from a word or a time", () => {
    expect(guessLanguage(ENGLISH)).toBe("en");
    expect(guessLanguage("Pessoal, o rally é hoje às 18:00. Não esqueçam as tropas!")).toBe(
      "pt-BR",
    );
    expect(guessLanguage("Bonjour à tous, le rally est à 18:00. Merci !")).toBe("fr");
    expect(guessLanguage("gg 18:00")).toBeNull();
  });

  it("offers every language but the message's own, and all three when it is not clear", async () => {
    const picked = (answer: Awaited<ReturnType<typeof forEveryone>>) => {
      const rows = (answer.body as { data: { components: { components: unknown[] }[] } }).data
        .components;
      const select = rows[0]?.components[0] as { options: { value: string; default: boolean }[] };
      return select.options.filter((o) => o.default).map((o) => o.value);
    };
    expect(picked(await forEveryone(ENGLISH))).toEqual(["p", "f"]);
    expect(picked(await forEveryone("Pessoal, o rally é hoje às 18:00. Não esqueçam!"))).toEqual([
      "e",
      "f",
    ]);
    expect(picked(await forEveryone("gg 18:00"))).toEqual(["e", "p", "f"]);
  });

  it("keeps mentions, links and custom emoji out of the request and puts them back verbatim", () => {
    const text =
      "<@123456789012345678> look https://example.test/a?b=1 <:gg:987654321098765432> @here";
    const masked = mask(text);
    expect(masked.text).toBe("{1} look {2} {3} {4}");
    expect(unmask("{1} olhe {2} {3} {4}", masked.kept)).toBe(
      "<@123456789012345678> olhe https://example.test/a?b=1 <:gg:987654321098765432> @here",
    );
  });
});

describe("the length cap", () => {
  it("translates 1,500 characters and says plainly when a message is longer", async () => {
    const at = "Please come. ".repeat(116).slice(0, 1500);
    expect((await forMe(at, { locale: "fr" })).translation).toBeDefined();
    const over = await forMe(`${at}x`, { locale: "pt-BR" });
    expect(over.translation).toBeUndefined();
    expect(JSON.stringify(over.body)).toContain(
      "Esta mensagem é longa demais para traduzir: 1.501 caracteres. O limite é 1.500.",
    );
  });
});

describe("the rate limit", () => {
  it(`allows ${TRANSLATE_PER_MINUTE} a minute per person, then refuses, and counts each person apart`, async () => {
    for (let i = 0; i < TRANSLATE_PER_MINUTE; i += 1) {
      expect((await forMe(ENGLISH, { locale: "fr" })).translation, `use ${i + 1}`).toBeDefined();
    }
    const refused = await forMe(ENGLISH, { locale: "fr" });
    expect(refused.translation).toBeUndefined();
    expect(JSON.stringify(refused.body)).toContain("Vous pouvez traduire 5 messages par minute.");
    expect(
      (await forMe(ENGLISH, { locale: "fr", userId: "700000000000000002" })).translation,
    ).toBeDefined();
  });
});

describe("the picker is the asker's own", () => {
  it("refuses a press from anyone else", async () => {
    const picker: Picker = {
      messageId: MESSAGE,
      userId: ASKER,
      from: "en",
      to: ["pt-BR"],
      where: "channel",
    };
    const press = { customId: pickerId("p", picker), values: undefined, shownText: ENGLISH };
    const other = await translateComponent(db, input({ userId: "700000000000000002" }), press, NOW);
    expect(other?.translation).toBeUndefined();
    expect(JSON.stringify(other?.body)).toContain(
      "Only the person who opened this menu can use it.",
    );
    const own = await translateComponent(db, input(), press, NOW);
    expect(own?.body).toEqual({ type: 6 });
    expect(own?.translation?.to).toEqual(["pt-BR"]);
  });
});

/** A translator that answers each language with an invented line, {1} kept. */
const model: ChatModel = {
  complete: async (request: ChatRequest) =>
    request.user.includes("to French") ? "Le rally {1} est à 18:00." : "O rally {1} é às 18:00.",
};

/** Discord, recorded: `thread` is what opening a thread answers. */
function discordStub(thread: Response) {
  const calls: { method: string; path: string; bot: boolean; body: Record<string, unknown> }[] = [];
  const fetcher: typeof fetch = async (url, init) => {
    const path = String(url).replace("https://discord.test/api", "");
    const bot = new Headers(init?.headers).get("authorization")?.startsWith("Bot ") ?? false;
    calls.push({ method: init?.method ?? "GET", path, bot, body: JSON.parse(String(init?.body)) });
    return path.endsWith("/threads") ? thread.clone() : Response.json({ id: "1" });
  };
  return { calls, fetcher };
}

const job = (where: "thread" | "channel", threads: boolean): TranslationJob => {
  const picker: Picker = {
    messageId: MESSAGE,
    userId: ASKER,
    from: "en",
    to: ["pt-BR", "fr"],
    where,
  };
  return {
    mode: "everyone",
    language: "en",
    from: "en",
    to: ["pt-BR", "fr"],
    ...mask("The rally <#1600000000000000009> is at 18:00."),
    webhook: { applicationId: "900", token: "itok" },
    post: {
      where,
      channelId: CHANNEL,
      link: `https://discord.com/channels/${GUILD}/${CHANNEL}/${MESSAGE}`,
      picker,
      threads,
    },
  };
};

const deps = (fetcher: typeof fetch, botToken?: string): TranslationDeps => ({
  ai: model,
  fetch: fetcher,
  discordBase: "https://discord.test/api",
  botToken,
  now: () => NOW,
});

describe("posting for everyone: a thread or the channel", () => {
  it("opens a thread on the message and posts each language in it as the bot, mentions off", async () => {
    const { calls, fetcher } = discordStub(
      Response.json({ id: "1700000000000000001" }, { status: 201 }),
    );
    await runTranslation(deps(fetcher, "bot-token-for-tests"), job("thread", true));
    const opened = calls.find((c) => c.path.endsWith("/threads"));
    expect(opened).toMatchObject({
      path: `/channels/${CHANNEL}/messages/${MESSAGE}/threads`,
      bot: true,
      body: { name: "Translation", auto_archive_duration: 1440 },
    });
    const posts = calls.filter((c) => c.path === "/channels/1700000000000000001/messages");
    expect(posts.map((p) => p.body.content)).toEqual([
      "**🇧🇷 Português**\nO rally <#1600000000000000009> é às 18:00.",
      "**🇫🇷 Français**\nLe rally <#1600000000000000009> est à 18:00.",
    ]);
    expect(
      posts.every((p) => p.bot && JSON.stringify(p.body.allowed_mentions) === '{"parse":[]}'),
    ).toBe(true);
    expect(calls.at(-1)).toMatchObject({
      method: "PATCH",
      body: { content: "Posted in the message’s thread.", components: [] },
    });
  });

  it("posts in the thread the message already has", async () => {
    const exists = Response.json(
      { code: 160004, message: "A thread has already been created" },
      { status: 400 },
    );
    const { calls, fetcher } = discordStub(exists);
    await runTranslation(deps(fetcher, "bot-token-for-tests"), job("thread", true));
    expect(calls.filter((c) => c.path === `/channels/${MESSAGE}/messages`)).toHaveLength(2);
  });

  it("falls back to the channel, and says so, when the bot cannot open a thread", async () => {
    const { calls, fetcher } = discordStub(Response.json({ code: 50013 }, { status: 403 }));
    await runTranslation(deps(fetcher, "bot-token-for-tests"), job("thread", true));
    const followUp = calls.find((c) => c.method === "POST" && c.path === "/webhooks/900/itok");
    expect(followUp?.bot).toBe(false);
    expect(followUp?.body.embeds).toHaveLength(2);
    expect(calls.at(-1)?.body.content).toBe(
      "Posted in the channel: the bot can’t open threads here.",
    );
  });

  it("posts in the channel with a link to the message when the channel was chosen or there is no bot", async () => {
    const { calls, fetcher } = discordStub(Response.json({}, { status: 500 }));
    await runTranslation(deps(fetcher, undefined), job("channel", false));
    expect(calls.some((c) => c.path.includes("/threads") || c.bot)).toBe(false);
    const followUp = calls.find((c) => c.path === "/webhooks/900/itok");
    expect(followUp?.body).toMatchObject({
      content: `https://discord.com/channels/${GUILD}/${CHANNEL}/${MESSAGE}`,
      embeds: [{ title: "🇧🇷 Português" }, { title: "🇫🇷 Français" }],
      allowed_mentions: { parse: [] },
    });
    expect(calls.at(-1)?.body.content).toBe("Posted in the channel.");
  });
});
