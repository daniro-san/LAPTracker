import { createHash } from "node:crypto";

import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { currentCount, recordFailure } from "../repo/auth-attempts";
import { translateComponent, type TranslateInput } from "./discord-translate";
import { TRANSLATE_PER_DAY, TRANSLATE_PER_MINUTE } from "./translate-limits";

// Invented server, people and message (D101, amended 2026-11-17).
const NOW = new Date("2026-11-17T20:00:00Z");
const ASKER = "700000000000000001";
const OTHER = "700000000000000002";
const ENGLISH = "Hello everyone, the rally is at 18:00 today. Please bring your troops!";

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
});

const input = (over: Partial<TranslateInput> = {}): TranslateInput => ({
  guildId: "1544808864262914060",
  channelId: "1600000000000000001",
  userId: ASKER,
  locale: "en-US",
  permissions: "0",
  webhook: { applicationId: "900", token: "itok" },
  bot: true,
  ...over,
});
const contentOf = (answer: { body: unknown } | null | undefined) =>
  (answer?.body as { data?: { content?: string } } | undefined)?.data?.content;

describe("Translate for me: a language button", () => {
  const pressSwitch = (customId: string, who: string = ASKER, owner: string | undefined = who) =>
    translateComponent(
      db,
      input({ userId: who }),
      { customId, values: undefined, shownText: ENGLISH, owner },
      NOW,
    );

  it("translates the text the reply shows into that language, taking the buttons away at once", async () => {
    const answer = await pressSwitch(`tm:p:e:${ASKER}`);
    expect(answer?.body).toEqual({ type: 7, data: { content: "Translating…", components: [] } });
    expect(answer?.translation).toMatchObject({
      mode: "me",
      from: "en",
      to: ["pt-BR"],
      text: ENGLISH,
      userId: ASKER,
      pressed: true,
    });
  });

  it("refuses a press by anyone else, or from a message that is not their private reply", async () => {
    // Someone else's press on the asker's buttons; the asker's press from a message that is not private.
    for (const answer of [
      await pressSwitch(`tm:p:e:${ASKER}`, OTHER),
      await pressSwitch(`tm:p:e:${ASKER}`, ASKER, OTHER),
    ]) {
      expect(answer?.translation).toBeUndefined();
      expect(contentOf(answer)).toBe("Only the person who opened this menu can use it.");
    }
  });

  it(`counts each press as one language against the ${TRANSLATE_PER_MINUTE} a minute`, async () => {
    for (let i = 0; i < TRANSLATE_PER_MINUTE; i += 1) {
      expect((await pressSwitch(`tm:f:e:${ASKER}`))?.translation).toBeDefined();
    }
    const refused = await pressSwitch(`tm:f:e:${ASKER}`);
    expect(refused?.body).toEqual({
      type: 7,
      data: { content: "You can translate 5 messages a minute. Wait a minute and try again." },
    });
  });

  it("refuses a shown text it cannot translate without counting it", async () => {
    const press = (shownText: string) =>
      translateComponent(
        db,
        input(),
        { customId: `tm:p:e:${ASKER}`, values: undefined, shownText, owner: ASKER },
        NOW,
      );
    const noLetters = await press("<@123456789012345678> https://example.test 18:00");
    expect(noLetters?.body).toEqual({
      type: 7,
      data: { content: "This message has no text to translate." },
    });
    expect((await press("x".repeat(1501)))?.translation).toBeUndefined();
    const person = `translate:${createHash("sha256").update(ASKER).digest("hex").slice(0, 32)}`;
    expect(await currentCount(db, person, 60_000, NOW)).toBe(0);
  });

  it("past the day's cap, says translations are paused and keeps the buttons", async () => {
    await recordFailure(db, "day:translate", 24 * 3_600_000, NOW, TRANSLATE_PER_DAY);
    // Type 7 with only a content: Discord keeps the embed and the buttons as they were.
    expect((await pressSwitch(`tm:p:e:${ASKER}`))?.body).toEqual({
      type: 7,
      data: { content: "Translations are paused for today. Try again tomorrow." },
    });
  });
});
