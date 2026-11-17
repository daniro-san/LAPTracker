// POST /api/w/[slug]/shots/read as "Read from a screenshot" uses it (D109): officers only, the text lines
// come back and the picture is kept nowhere, one read at a time per officer. The OCR is stubbed.
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import { testContext } from "@/lib/app-context.test-helpers";
import { T0 } from "@/lib/collector.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb, truncateAll } from "@/lib/db.test-helpers";
import { createSession, SESSION_COOKIE } from "@/lib/private/session";
import { workspaces, workspaceUsers } from "@/lib/schema";
import { screenshotDrafts } from "@/lib/schema-import";

const holder = vi.hoisted(() => ({
  ctx: null as AppContext | null,
  release: null as (() => void) | null,
  seen: [] as number[],
}));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));
vi.mock("@/lib/private/import-read", async (original) => ({
  ...(await original<typeof import("@/lib/private/import-read")>()),
  readUpload: async (bytes: Uint8Array) => {
    holder.seen.push(bytes.length);
    await new Promise<void>((resolve) => (holder.release = resolve));
    return ["Lv.27 [OGs] Ana", "AD Tech 74%"];
  },
}));

const { POST } = await import("./route");

const ORIGIN = "https://laptracker.test";
let db: Db;
const tokens = { officer: "", member: "" };
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  holder.ctx = testContext(db).ctx;
  const [ws] = await db
    .insert(workspaces)
    .values({ unionId: 67111155, slug: "ogs", discordGuildId: "1", leaderRoleIds: ["2"] })
    .returning({ id: workspaces.id });
  for (const tier of ["officer", "member"] as const) {
    const [user] = await db
      .insert(workspaceUsers)
      .values({ workspaceId: ws?.id ?? 0, discordUserId: `ogs-${tier}`, displayName: tier })
      .returning({ id: workspaceUsers.id });
    tokens[tier] = (await createSession(db, ws?.id ?? 0, user?.id ?? 0, T0, null, tier)).token;
  }
});

const picture = (token: string) =>
  POST(
    new Request(`${ORIGIN}/api/w/ogs/shots/read`, {
      method: "POST",
      headers: {
        origin: ORIGIN,
        "sec-fetch-site": "same-origin",
        "content-type": "image/png",
        cookie: `${SESSION_COOKIE}=${token}`,
      },
      body: new Uint8Array([137, 80, 78, 71, 1, 2, 3]),
    }),
    { params: Promise.resolve({ slug: "ogs" }) },
  );

describe("Read from a screenshot (D109)", () => {
  it("answers an officer with the lines, one read at a time, refuses a member, and keeps no picture", async () => {
    const member = await picture(tokens.member);
    expect([member.status, await member.json()]).toEqual([401, { code: "signed_out" }]);
    const first = picture(tokens.officer);
    await vi.waitFor(() => expect(holder.release).not.toBeNull());
    const second = await picture(tokens.officer);
    expect([second.status, await second.json()]).toEqual([429, { code: "busy" }]);
    holder.release?.();
    const answer = await first;
    expect([answer.status, await answer.json()]).toEqual([
      200,
      { lines: ["Lv.27 [OGs] Ana", "AD Tech 74%"] },
    ]);
    // Only the officer's one picture reached the reader; nothing was stored from it.
    expect(holder.seen).toEqual([7]);
    expect(await db.select().from(screenshotDrafts)).toEqual([]);
  });
});
