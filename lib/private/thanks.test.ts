// "Share the thanks" (issue 404, D114): the writing help's request carries no number and no name, and a
// draft that drops or invents a placeholder is refused; names come back as written, even "{1}" or "@here";
// the copy for the game stays within its 1,000 characters; Discord gets the post once per request id, pings
// no one, refuses the same week within 30 s, and a failed or stuck post can be tried again; Take down
// refuses another workspace's share and a Discord share; the Sunday and Monday nudge. Groq and Discord are
// stand-ins. Invented names only.
import { randomUUID } from "node:crypto";

import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { ChatError, type ChatModel, type ChatRequest } from "../ai/groq";
import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { findWorkspaceBySlug, recordSignIn, saveWorkspace } from "../repo/workspaces";
import { thanksShares } from "../schema-board";
import { requireWorkspace, type WorkspaceAccess } from "./access";
import { gameNotice } from "./notice-formats";
import { STUCK_MS } from "./notice-publish";
import { NOTICE_LIMIT, noticeLength } from "./notice-rules";
import { createSession } from "./session";
import {
  draftThanks,
  shareThanks,
  takeDownThanks,
  thanksNudge,
  type ShareDeps,
  type ShareInput,
} from "./thanks";

const NOW = new Date("2026-11-22T12:00:00Z");

/** A stand-in for the model: keeps each request and answers from the number of people it was given. */
function stub(answer: (people: number) => string) {
  const asked: ChatRequest[] = [];
  const model: ChatModel = {
    complete: async (request) => {
      asked.push(request);
      return answer(request.user.match(/^\{\d+\}:/gm)?.length ?? 0);
    },
  };
  return { model, asked };
}

describe("the weekly appreciation post's writing help (D114)", () => {
  it("sends placeholders, plain deeds and the officer's words: no name, no number", async () => {
    const { model, asked } = stub(() => "Hi all.\n{1} grew.\n{2} finished.\n{3}, thank you.\nBye.");
    const people = [
      { name: "Bramble 77", did: ["squad" as const] },
      { name: "Thistle", did: ["ad" as const], note: "helped the new ones {settle} in" },
      { name: "Wobbleton", did: [] },
    ];
    const texts = await draftThanks(model, { people, lastWeek: true });
    expect(asked).toHaveLength(3);
    for (const request of asked) {
      const sent = `${request.system}\n${request.user}`.replace(/\{\d+\}/g, "");
      expect(sent).not.toMatch(/\d/);
      for (const { name } of people) expect(sent).not.toContain(name.split(" ")[0]);
      expect(request.user).toContain("last week");
      expect(request.user).toContain("in the officer's words: helped the new ones settle in");
      expect(request.user).toContain("{3}: no reason given");
    }
    expect(asked[1]?.user).toContain("aumentou o esquadrão principal");
    expect(texts.en).toBe(
      "Hi all.\nBramble 77 grew.\nThistle finished.\nWobbleton, thank you.\nBye.",
    );
  });

  it("refuses a draft that dropped or invented a placeholder", async () => {
    const people = [
      { name: "Bramble", did: ["squad" as const] },
      { name: "Thistle", did: [] },
    ];
    for (const answer of ["Thank you {1}.", "Thank you {1}, {2} and {3}."]) {
      const { model } = stub(() => answer);
      await expect(draftThanks(model, { people, lastWeek: false })).rejects.toBeInstanceOf(
        ChatError,
      );
    }
  });

  it("puts names back as written, even one that looks like a placeholder or a mention", async () => {
    const { model } = stub(() => "Thank you {1} and {2}.");
    const people = [
      { name: "{1}Rook", did: [] },
      { name: "@here", did: [] },
    ];
    const { en } = await draftThanks(model, { people, lastWeek: false });
    expect(en).toBe("Thank you {1}Rook and @here.");
  });

  it("keeps the copy for the game within its 1,000 characters, cut after a whole line", async () => {
    const line = "Thank you {1}, your care for this alliance shows in everything you do for us.";
    const { model } = stub((n) =>
      Array.from({ length: 20 }, () => line)
        .concat(Array.from({ length: n - 1 }, (_, i) => `And {${i + 2}}.`))
        .join("\n"),
    );
    const people = Array.from({ length: 5 }, (_, i) => ({
      name: `Friend${"x".repeat(i)}`,
      did: [],
    }));
    const { en } = await draftThanks(model, { people, lastWeek: false });
    expect(noticeLength(en)).toBeGreaterThan(NOTICE_LIMIT);
    const copy = gameNotice(en);
    expect(copy.cut).toBe(true);
    expect(noticeLength(copy.text)).toBeLessThanOrEqual(NOTICE_LIMIT);
    expect(en.startsWith(copy.text) && en[copy.text.length]).toBe("\n");
  });
});

describe("sharing the thanks (D114)", () => {
  let db: Db;
  let access: WorkspaceAccess;
  let sent: { url: string; body: Record<string, unknown> }[];
  let refuse: boolean;
  beforeAll(async () => {
    db = await openTestDb();
  });

  async function officer(slug: string, unionId: number) {
    await saveWorkspace(db, {
      unionId,
      slug,
      discordGuildId: String(unionId),
      leaderRoleIds: ["2"],
      memberRoleIds: ["3"],
    });
    const ws = (await findWorkspaceBySlug(db, slug))?.id ?? 0;
    const userId = await recordSignIn(db, ws, `id-rook-${slug}`, "Rook", NOW);
    const { token } = await createSession(db, ws, userId, NOW, null, "officer");
    const signed = await requireWorkspace(db, slug, { get: () => ({ value: token }) }, NOW);
    if (!signed.ok) throw new Error("no access");
    return signed;
  }

  beforeEach(async () => {
    await truncateAll(db);
    access = await officer("ogs", 67111155);
    sent = [];
    refuse = false;
  });

  const deps = (now = NOW): ShareDeps => ({
    now,
    names: { en: "English", "pt-BR": "Português", fr: "Français" },
    channels: {
      members: { url: "https://discord.com/api/webhooks/1/m", name: "guides", forum: false },
      leaders: { url: "https://discord.com/api/webhooks/1/l", name: "notices", forum: false },
    },
    fetch: async (input, init) => {
      sent.push({ url: String(input), body: JSON.parse(String(init?.body)) });
      return refuse ? new Response(null, { status: 500 }) : Response.json({ id: "m1" });
    },
  });
  const input = (over: Partial<ShareInput> = {}): ShareInput => ({
    action: "share",
    target: "discord",
    week: "2026-11-16",
    title: "Weekly appreciation · Nov 16 – Nov 22",
    texts: { en: "Thank you, Bramble.", "pt-BR": "Obrigado, Bramble." },
    names: ["Bramble"],
    requestId: randomUUID(),
    ...over,
  });

  it("posts once per request id to the members' channel, and pings no one", async () => {
    const names = ["@here", "{1}Rook"];
    const texts = { en: "Thank you @everyone, <@123>, @here and {1}Rook.", "pt-BR": "Obrigado." };
    const once = input({ texts, names });
    expect((await shareThanks(db, access, once, deps())).ok).toBe(true);
    // A double tap, or a retry after a lost answer: the same request id posts nothing more.
    expect((await shareThanks(db, access, once, deps())).ok).toBe(true);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.url).toContain("/webhooks/1/m?wait=true");
    expect(sent[0]?.body.allowed_mentions).toEqual({ parse: [] });
    const content = String(sent[0]?.body.content);
    expect(content).toContain("**English**");
    expect(content).toContain("**Português**");
    expect(content).toContain("{1}Rook");
    expect(content).not.toMatch(/@(everyone|here)|<@1/);
    const [row] = await db.select({ names: thanksShares.names }).from(thanksShares);
    expect(row?.names).toEqual(names);
  });

  it("refuses the same week to the same place within 30 s, from another sheet", async () => {
    expect((await shareThanks(db, access, input(), deps())).ok).toBe(true);
    const again = await shareThanks(db, access, input(), deps(new Date(NOW.getTime() + 10_000)));
    expect(again).toEqual({ ok: false, code: "recent" });
    // The board is another place, and a minute later Discord is open again.
    expect((await shareThanks(db, access, input({ target: "board" }), deps())).ok).toBe(true);
    const later = deps(new Date(NOW.getTime() + 60_000));
    expect((await shareThanks(db, access, input(), later)).ok).toBe(true);
    expect(sent).toHaveLength(2);
  });

  it("marks a refused post failed, lets a new request id try again, and counts a stuck one failed", async () => {
    refuse = true;
    const first = input();
    expect(await shareThanks(db, access, first, deps())).toEqual({ ok: false, code: "failed" });
    const [row] = await db.select({ status: thanksShares.status }).from(thanksShares);
    expect(row?.status).toBe("failed");
    refuse = false;
    // The same id gets its first answer; a new id posts at once (a failed post is no cooldown).
    expect(await shareThanks(db, access, first, deps())).toEqual({ ok: false, code: "failed" });
    expect((await shareThanks(db, access, input(), deps())).ok).toBe(true);
    // A claim still "posting" from a run that died: "posting" for a while, then "failed".
    const stuck = randomUUID();
    await db.insert(thanksShares).values({
      workspaceId: access.workspaceId,
      requestId: stuck,
      target: "discord",
      week: "2026-11-09",
      texts: { en: "x" },
      names: [],
      status: "posting",
      sharedBy: access.user.id,
      sharedAt: NOW,
    });
    const retry = input({ week: "2026-11-09", requestId: stuck });
    expect(await shareThanks(db, access, retry, deps())).toEqual({ ok: false, code: "posting" });
    const late = deps(new Date(NOW.getTime() + STUCK_MS));
    expect(await shareThanks(db, access, retry, late)).toEqual({ ok: false, code: "failed" });
  });

  it("takes down only this workspace's board card", async () => {
    const other = await officer("nse", 67109944);
    const theirs = await shareThanks(db, other, input({ target: "board" }), deps());
    const discord = await shareThanks(db, access, input(), deps());
    const mine = await shareThanks(db, access, input({ target: "board" }), deps());
    if (!theirs.ok || !discord.ok || !mine.ok) throw new Error("not shared");
    expect(await takeDownThanks(db, access, theirs.row.id, NOW)).toBe(false);
    expect(await takeDownThanks(db, access, discord.row.id, NOW)).toBe(false);
    expect(await takeDownThanks(db, access, mine.row.id, NOW)).toBe(true);
  });

  it("nudges on Sunday and Monday only, until the week's thanks are shared", async () => {
    expect(await thanksNudge(db, access, "2026-11-22")).toBe(true); // Sunday
    expect(await thanksNudge(db, access, "2026-11-23")).toBe(true); // Monday: last week's
    expect(await thanksNudge(db, access, "2026-11-24")).toBe(false); // Tuesday
    expect((await shareThanks(db, access, input({ target: "board" }), deps())).ok).toBe(true);
    expect(await thanksNudge(db, access, "2026-11-22")).toBe(false);
    expect(await thanksNudge(db, access, "2026-11-23")).toBe(false);
  });
});
