// `/join` (issue 868): a signed command records the request and answers privately; an unsigned one records
// nothing; one person is limited per hour; a request expires after 7 days. Invented ids only.
import { generateKeyPairSync } from "node:crypto";

import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { joinSince, purgeOldJoinRequests } from "../repo/join-requests";
import { joinRequests } from "../schema-discord";
import { GUILD, interactions, NOW, seedOgs, signed } from "./discord-interaction.test-helpers";

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  await seedOgs(db);
});

const { handle } = interactions(() => db);

/** `/join` as Discord sends it, by `user`, typing `player`. */
const join = (player: string, user = "700000000000000002") => ({
  type: 2,
  application_id: "900",
  token: "interaction-token",
  guild_id: GUILD,
  locale: "pt-BR",
  guild_locale: "fr",
  member: { nick: "Moss", roles: [], user: { id: user, username: "moss" } },
  data: { name: "join", type: 1, options: [{ name: "player", type: 3, value: player }] },
});

describe("/join (issue 868)", () => {
  it("records the request and answers only the sender, in their language", async () => {
    const handled = await handle(signed(join("  Moss   Invented ")));
    expect(handled).toMatchObject({
      status: 200,
      body: { type: 4, data: { flags: 64, content: "Enviado aos seus oficiais." } },
      joinNote: { slug: "ogs", typed: "Moss Invented", language: "fr" },
    });
    const rows = await db.select().from(joinRequests);
    expect(rows).toMatchObject([
      { discordUserId: "700000000000000002", discordName: "Moss", typed: "Moss Invented" },
    ]);
    // A second /join replaces the typed name; the leaders already heard of this request.
    const again = await handle(signed(join("990001")));
    expect("joinNote" in again).toBe(false);
    expect((await db.select().from(joinRequests)).map((r) => r.typed)).toEqual(["990001"]);
  });

  it("records nothing from a request Discord did not sign", async () => {
    const forged = signed(join("Moss"), generateKeyPairSync("ed25519").privateKey);
    expect(await handle(forged)).toEqual({ status: 401, body: { code: "bad_signature" } });
    expect(await db.select().from(joinRequests)).toEqual([]);
  });

  it("refuses a person's fourth request in an hour", async () => {
    for (const name of ["A", "B", "C"]) await handle(signed(join(name)));
    const fourth = await handle(signed(join("D")));
    expect(JSON.stringify(fourth.body)).toContain("Tente de novo em uma hora");
    expect((await db.select().from(joinRequests)).map((r) => r.typed)).toEqual(["C"]);
  });

  it("lets the daily tick purge a request older than 7 days", async () => {
    await handle(signed(join("Moss")));
    const old = new Date(NOW.getTime() - 8 * 86_400_000);
    await db.update(joinRequests).set({ createdAt: old });
    expect(await purgeOldJoinRequests(db, joinSince(NOW))).toBe(1);
    expect(await db.select().from(joinRequests)).toEqual([]);
  });
});
