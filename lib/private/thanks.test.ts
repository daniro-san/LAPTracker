// "Share the thanks" (issue 404, D114): the writing help's request carries no number and no name; the copy
// for the game stays within its 1,000 characters; Discord gets the post once per request id and can ping no
// one. Groq and Discord are stand-ins. Invented names only.
import { randomUUID } from "node:crypto";

import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { ChatModel, ChatRequest } from "../ai/groq";
import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { findWorkspaceBySlug, recordSignIn, saveWorkspace } from "../repo/workspaces";
import { requireWorkspace, type WorkspaceAccess } from "./access";
import { gameNotice } from "./notice-formats";
import { NOTICE_LIMIT, noticeLength } from "./notice-rules";
import { createSession } from "./session";
import { draftThanks, shareThanks, thanksNudge, type ShareInput } from "./thanks";

const NOW = new Date("2026-11-22T12:00:00Z");

/** A stand-in for the model: keeps each request and answers with every placeholder it was given. */
function stub(answer: (people: number) => string) {
  const asked: ChatRequest[] = [];
  const model: ChatModel = {
    complete: async (request) => {
      asked.push(request);
      return answer(request.user.match(/\{\d+\}:/g)?.length ?? 0);
    },
  };
  return { model, asked };
}

describe("the weekly appreciation post's writing help (D114)", () => {
  it("sends no number and no name: placeholders and plain deeds; the names go back in after", async () => {
    const { model, asked } = stub(
      () => "Thank you {1} and {2}, it means a lot.\nAnd {3}, welcome.",
    );
    const people = [
      { name: "Bramble 77", did: ["squad" as const] },
      { name: "Thistle", did: ["ad" as const, "squad" as const] },
      { name: "Wobbleton", did: [] },
    ];
    const texts = await draftThanks(model, { people, lastWeek: true });
    expect(asked).toHaveLength(3);
    for (const request of asked) {
      const sent = `${request.system}\n${request.user}`.replace(/\{\d+\}/g, "");
      expect(sent).not.toMatch(/\d/);
      for (const { name } of people) expect(sent).not.toContain(name.split(" ")[0]);
      expect(request.user).toContain("last week");
    }
    expect(asked[1]?.user).toContain("aumentou o esquadrão principal");
    expect(texts.en).toBe(
      "Thank you Bramble 77 and Thistle, it means a lot.\nAnd Wobbleton, welcome.",
    );
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

describe("posting the thanks to Discord (D114)", () => {
  let db: Db;
  let access: WorkspaceAccess;
  beforeAll(async () => {
    db = await openTestDb();
  });
  beforeEach(async () => {
    await truncateAll(db);
    await saveWorkspace(db, {
      unionId: 67111155,
      slug: "ogs",
      discordGuildId: "1",
      leaderRoleIds: ["2"],
      memberRoleIds: ["3"],
    });
    const ws = (await findWorkspaceBySlug(db, "ogs"))?.id ?? 0;
    const userId = await recordSignIn(db, ws, "id-rook", "Rook", NOW);
    const { token } = await createSession(db, ws, userId, NOW, null, "officer");
    const signed = await requireWorkspace(db, "ogs", { get: () => ({ value: token }) }, NOW);
    if (!signed.ok) throw new Error("no access");
    access = signed;
  });

  it("posts once per request id to the members' channel, and pings no one", async () => {
    const sent: { url: string; body: Record<string, unknown> }[] = [];
    const deps = {
      now: NOW,
      names: { en: "English", "pt-BR": "Português", fr: "Français" },
      channels: {
        members: { url: "https://discord.com/api/webhooks/1/m", name: "guides", forum: false },
        leaders: { url: "https://discord.com/api/webhooks/1/l", name: "notices", forum: false },
      },
      fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
        sent.push({ url: String(input), body: JSON.parse(String(init?.body)) });
        return Response.json({ id: "m1", channel_id: "900" });
      },
    };
    const input: ShareInput = {
      action: "share",
      target: "discord",
      week: "2026-11-16",
      title: "Weekly appreciation · Nov 16 – Nov 22",
      texts: { en: "Thank you @everyone, and <@123> Bramble.", "pt-BR": "Obrigado, Bramble." },
      names: ["Bramble"],
      requestId: randomUUID(),
    };
    expect((await shareThanks(db, access, input, deps)).ok).toBe(true);
    // A double tap, or a retry after a lost answer: the same request id posts nothing more.
    expect((await shareThanks(db, access, input, deps)).ok).toBe(true);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.url).toContain("/webhooks/1/m?wait=true");
    expect(sent[0]?.body.allowed_mentions).toEqual({ parse: [] });
    const content = String(sent[0]?.body.content);
    expect(content).toContain("**English**");
    expect(content).toContain("**Português**");
    expect(content).not.toContain("@everyone");
    expect(content).not.toContain("<@123>");
  });

  it("nudges on Sunday and Monday only, until the week's thanks are shared", async () => {
    expect(await thanksNudge(db, access, "2026-11-22")).toBe(true); // Sunday
    expect(await thanksNudge(db, access, "2026-11-23")).toBe(true); // Monday: last week's
    expect(await thanksNudge(db, access, "2026-11-24")).toBe(false); // Tuesday
    const deps = {
      now: NOW,
      names: { en: "English", "pt-BR": "Português", fr: "Français" },
      channels: { members: null, leaders: null },
      fetch: () => Promise.reject(new Error("no Discord here")),
    };
    const board = { action: "share", target: "board", title: "Weekly appreciation" } as const;
    const texts = { en: "Thank you, Bramble." };
    const shared = {
      ...board,
      week: "2026-11-16",
      texts,
      names: ["Bramble"],
      requestId: randomUUID(),
    };
    expect((await shareThanks(db, access, shared, deps)).ok).toBe(true);
    expect(await thanksNudge(db, access, "2026-11-22")).toBe(false);
    expect(await thanksNudge(db, access, "2026-11-23")).toBe(false);
  });
});
