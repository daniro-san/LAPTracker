import { generateKeyPairSync, sign } from "node:crypto";

import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { recordFailure } from "../repo/auth-attempts";
import { saveWorkspace } from "../repo/workspaces";
import { handleInteraction } from "./discord-interaction";
import { translateCommand, translateComponent, type TranslateInput } from "./discord-translate";
import { TRANSLATE_PER_DAY, TRANSLATE_PER_MINUTE } from "./translate-limits";
import { guessLanguage, mask, pickerId, type Picker, unmask } from "./translate-message";

// Invented server, people and messages.
const NOW = new Date("2026-11-17T20:00:00Z");
const GUILD = "1544808864262914060";
const CHANNEL = "1600000000000000001";
const MESSAGE = "1600000000000000055";
const ASKER = "700000000000000001";
const OTHER = "700000000000000002";
const ENGLISH = "Hello everyone, the rally is at 18:00 today. Please bring your troops!";
/** Send Messages, Create Public Threads and Send Messages in Threads. */
const ALL = String((1n << 11n) | (1n << 35n) | (1n << 38n));
const CHANNEL_ONLY = String(1n << 11n);

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
  permissions: ALL,
  webhook: { applicationId: "900", token: "itok" },
  bot: true,
  ...over,
});

const forMe = (content: string, over: Partial<TranslateInput> = {}) =>
  translateCommand(db, "me", input(over), { messageId: MESSAGE, content }, NOW);
const forEveryone = (content: string, over: Partial<TranslateInput> = {}) =>
  translateCommand(db, "everyone", input(over), { messageId: MESSAGE, content }, NOW);

type Rows = {
  components: { custom_id: string; options?: { value: string; default: boolean }[] }[];
}[];
const rowsOf = (answer: { body: unknown }) =>
  (answer.body as { data: { components: Rows } }).data.components;
const contentOf = (answer: { body: unknown } | null | undefined) =>
  (answer?.body as { data?: { content?: string } } | undefined)?.data?.content;
const buttonsOf = (answer: { body: unknown }) =>
  (rowsOf(answer) as unknown as { components: { label: string; custom_id: string }[] }[]).flatMap(
    (r) => r.components.map((c) => [c.label, c.custom_id]),
  );

const picker = (over: Partial<Picker> = {}): Picker => ({
  messageId: MESSAGE,
  userId: ASKER,
  from: "en",
  to: ["pt-BR"],
  where: "thread",
  ...over,
});
const press = (p: Picker, over: { owner?: string | undefined } = {}) => ({
  customId: pickerId("p", p),
  values: undefined,
  shownText: ENGLISH,
  owner: ASKER,
  ...over,
});

describe("Translate for me: the asker's Discord language (D101)", () => {
  it("maps pt-BR, fr and fr-CA to their language, and any other locale to English", async () => {
    const french = "Bonjour à tous, le rally est à 18:00. Merci de venir avec vos troupes !";
    for (const [locale, language] of [
      ["pt-BR", "pt-BR"],
      ["fr", "fr"],
      ["fr-CA", "fr"],
      ["en-GB", "en"],
      ["es-ES", "en"],
    ] as const) {
      // Five languages in a minute: exactly the per-person limit.
      const answer = await forMe(language === "fr" ? ENGLISH : french, { locale });
      expect(answer.translation?.to, locale).toEqual([language]);
    }
  });

  it("answers at once, without the translator, with the two other languages when the message is already in that language", async () => {
    const answer = await forMe(ENGLISH, { permissions: "0" });
    expect(answer.translation).toBeUndefined();
    expect(answer.body).toMatchObject({
      type: 4,
      data: {
        flags: 64,
        embeds: [{ description: ENGLISH, footer: { text: "Already in English. Translate to:" } }],
        allowed_mentions: { parse: [] },
      },
    });
    expect(buttonsOf(answer)).toEqual([
      ["Português", `tm:p:e:${ASKER}`],
      ["Français", `tm:f:e:${ASKER}`],
    ]);
  });
});

describe("which languages are produced", () => {
  it("guesses English, Portuguese and French, and nothing from a word, a time or shared words", () => {
    expect(guessLanguage(ENGLISH)).toBe("en");
    expect(guessLanguage("Pessoal, o rally é hoje às 18:00. Não esqueçam as tropas!")).toBe(
      "pt-BR",
    );
    expect(guessLanguage("Bonjour à tous, le rally est à 18:00. Merci !")).toBe("fr");
    expect(guessLanguage("gg 18:00")).toBeNull();
    // "mais" and "nos" are French too; the curly apostrophe counts as the straight one.
    expect(guessLanguage("Mais bien sûr, nos amis")).not.toBe("pt-BR");
    expect(guessLanguage("don’t")).toBe("en");
  });

  it("offers every language but the message's own, and all three when it is not clear", async () => {
    const picked = async (text: string) =>
      rowsOf(await forEveryone(text))[0]
        ?.components[0]?.options?.filter((o) => o.default)
        .map((o) => o.value);
    expect(await picked(ENGLISH)).toEqual(["p", "f"]);
    expect(await picked("Pessoal, o rally é hoje às 18:00. Não esqueçam!")).toEqual(["e", "f"]);
    expect(await picked("gg 18:00")).toEqual(["e", "p", "f"]);
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

describe("where the asker may post: their permissions in this channel", () => {
  it("offers Thread and Channel, Channel alone, or says plainly they cannot post here", async () => {
    const places = (answer: { body: unknown }) =>
      rowsOf(answer).flatMap((r) => r.components.map((c) => c.custom_id.slice(0, 4)));
    expect(places(await forEveryone(ENGLISH))).toEqual(["tr:l", "tr:t", "tr:c", "tr:p"]);
    const channel = await forEveryone(ENGLISH, { permissions: CHANNEL_ONLY });
    expect(places(channel)).toEqual(["tr:l", "tr:p"]);
    expect(contentOf(channel)).toBe(
      "Choose the languages, then press Post. It is posted in the channel for everyone.",
    );
    const noBot = await forEveryone(ENGLISH, { bot: false });
    expect(contentOf(noBot)).toContain("Threads need the bot. See /admin.");
    const none = await forEveryone(ENGLISH, { permissions: "0" });
    expect(none.body).toEqual({
      type: 4,
      data: { content: "You can’t post in this channel.", flags: 64 },
    });
  });

  it("checks the permissions again at Post, from the press itself", async () => {
    const lost = await translateComponent(
      db,
      input({ permissions: CHANNEL_ONLY }),
      press(picker()),
      NOW,
    );
    expect(lost?.translation).toBeUndefined();
    expect(lost?.body).toEqual({ type: 7, data: { content: "You can’t post in this channel." } });
  });
});

describe("the picker is the asker's own", () => {
  it("refuses a press from anyone else or from a message that is not their private picker", async () => {
    const p = picker();
    for (const [who, owner] of [
      [OTHER, ASKER],
      [ASKER, OTHER],
      [ASKER, undefined],
    ] as const) {
      const answer = await translateComponent(db, input({ userId: who }), press(p, { owner }), NOW);
      expect(contentOf(answer), `${who} ${owner}`).toBe(
        "Only the person who opened this menu can use it.",
      );
    }
    const own = await translateComponent(db, input(), press(p), NOW);
    // Post takes the buttons away at once, keeping the text, so a second press cannot post twice.
    expect(own?.body).toEqual({ type: 7, data: { content: "Translating…", components: [] } });
    expect(own?.translation?.post?.where).toBe("thread");
  });
});

describe("limits", () => {
  it("translates 1,500 characters and says plainly when a message is longer", async () => {
    const at = "Please come. ".repeat(116).slice(0, 1500);
    expect((await forMe(at, { locale: "fr" })).translation).toBeDefined();
    const over = await forMe(`${at}x`, { locale: "pt-BR" });
    expect(over.translation).toBeUndefined();
    expect(contentOf(over)).toBe(
      "Esta mensagem é longa demais para traduzir: 1.501 caracteres. O limite é 1.500.",
    );
  });

  it(`allows ${TRANSLATE_PER_MINUTE} languages a minute per person, counting each language of a Post`, async () => {
    const three = picker({ to: ["en", "pt-BR", "fr"], from: null });
    expect((await translateComponent(db, input(), press(three), NOW))?.translation).toBeDefined();
    expect((await forMe(ENGLISH, { locale: "fr" })).translation).toBeDefined();
    expect((await forMe(ENGLISH, { locale: "fr" })).translation).toBeDefined();
    const refused = await forMe(ENGLISH, { locale: "fr" });
    expect(contentOf(refused)).toBe(
      "Vous pouvez traduire 5 messages par minute. Attendez une minute et réessayez.",
    );
    expect((await forMe(ENGLISH, { locale: "fr", userId: OTHER })).translation).toBeDefined();
  });

  it(`pauses everyone for the day past ${TRANSLATE_PER_DAY} languages`, async () => {
    await recordFailure(db, "day:translate", 24 * 3_600_000, NOW, TRANSLATE_PER_DAY - 1);
    const two = await translateComponent(db, input(), press(picker({ to: ["pt-BR", "fr"] })), NOW);
    expect(two?.body).toEqual({
      type: 7,
      data: { content: "Translations are paused for today. Try again tomorrow." },
    });
    expect((await forMe(ENGLISH, { locale: "fr" })).translation).toBeDefined();
    expect(contentOf(await forMe(ENGLISH, { locale: "fr", userId: OTHER }))).toBe(
      "Les traductions sont en pause pour aujourd’hui. Réessayez demain.",
    );
  });
});

describe("handleInteraction routes the Translate interactions", () => {
  const keys = generateKeyPairSync("ed25519");
  const publicKey = Buffer.from(
    String(keys.publicKey.export({ format: "jwk" }).x),
    "base64url",
  ).toString("hex");
  const signed = (payload: unknown) => {
    const body = JSON.stringify(payload);
    const timestamp = String(Math.floor(NOW.getTime() / 1000));
    return {
      body,
      timestamp,
      signature: sign(null, Buffer.from(timestamp + body), keys.privateKey).toString("hex"),
    };
  };
  const base = {
    application_id: "900",
    token: "itok",
    guild_id: GUILD,
    channel_id: CHANNEL,
    locale: "en-US",
    member: { roles: [], permissions: ALL, user: { id: ASKER, username: "asker" } },
  };
  const command = (name: string) => ({
    ...base,
    type: 2,
    data: {
      name,
      type: 3,
      target_id: MESSAGE,
      resolved: {
        messages: {
          [MESSAGE]: { timestamp: "2026-11-17T19:00:00Z", content: ENGLISH, attachments: [] },
        },
      },
    },
  });
  const handle = (payload: unknown) =>
    handleInteraction(db, publicKey, signed(payload), NOW, "https://laptracker.test", true);

  it("answers both Translate commands, a signed picker press, and refuses an unknown command", async () => {
    expect(await handle(command("Translate for me"))).toMatchObject({
      status: 200,
      body: { type: 4, data: { flags: 64, embeds: [{ description: ENGLISH }] } },
    });
    expect(await handle({ ...command("Translate for me"), locale: "fr" })).toMatchObject({
      status: 200,
      body: { type: 5, data: { flags: 64 } },
      translation: { mode: "me", to: ["fr"] },
    });
    expect(await handle(command("Translate for everyone"))).toMatchObject({
      status: 200,
      body: { type: 4, data: { flags: 64, embeds: [{ description: ENGLISH }] } },
    });
    const pressed = await handle({
      ...base,
      type: 3,
      message: {
        flags: 64,
        embeds: [{ description: ENGLISH }],
        interaction_metadata: { user: { id: ASKER } },
      },
      data: { custom_id: pickerId("p", picker({ to: ["fr"] })), component_type: 2 },
    });
    expect(pressed).toMatchObject({ status: 200, body: { type: 7 }, translation: { to: ["fr"] } });
    expect(await handle(command("Translate for nobody"))).toEqual({
      status: 400,
      body: { code: "unknown_command" },
    });
  });
});
