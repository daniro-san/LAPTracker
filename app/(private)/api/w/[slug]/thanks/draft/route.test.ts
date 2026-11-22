// POST /api/w/[slug]/thanks/draft (D114) and the alliance's switches (D126): turned off, it answers 403
// and asks the model nothing; past the daily AI cap, 429 cap_reached and nothing is asked; when one of the
// three languages fails at Groq, only that language's unit is given back.
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ChatError, type ChatModel } from "@/lib/ai/groq";
import type { AppContext } from "@/lib/app-context";
import { testContext } from "@/lib/app-context.test-helpers";
import { T0 } from "@/lib/collector.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb, truncateAll } from "@/lib/db.test-helpers";
import { createSession, SESSION_COOKIE } from "@/lib/private/session";
import { workspaces, workspaceUsers } from "@/lib/schema";
import { workspaceFeatures, workspaceUsage } from "@/lib/schema-features";

const holder = vi.hoisted(() => ({ ctx: null as AppContext | null }));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));

const { POST } = await import("./route");

let db: Db;
let token: string;
let asked: string[];
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  await db
    .insert(workspaces)
    .values({ unionId: 67111155, slug: "ogs", discordGuildId: "1", leaderRoleIds: ["2"] });
  const [user] = await db
    .insert(workspaceUsers)
    .values({ workspaceId: 1, discordUserId: "id-ana", displayName: "Ana" })
    .returning({ id: workspaceUsers.id });
  token = (await createSession(db, 1, user?.id ?? 0, T0, null, "officer")).token;
  asked = [];
  // French fails at Groq; the other two languages answer.
  const ai: ChatModel = {
    complete: async (request) => {
      asked.push(request.user);
      if (request.user.includes(" in French.")) throw new ChatError("busy");
      return "Thank you, {1}.";
    },
  };
  holder.ctx = { ...testContext(db).ctx, ai: () => ai };
});

const draft = () =>
  POST(
    new Request("https://laptracker.test/api/w/ogs/thanks/draft", {
      method: "POST",
      headers: {
        origin: "https://laptracker.test",
        "content-type": "application/json",
        cookie: `${SESSION_COOKIE}=${token}`,
      },
      body: JSON.stringify({ people: [{ name: "Bramble", did: ["squad"] }], lastWeek: false }),
    }),
    { params: Promise.resolve({ slug: "ogs" }) },
  );
const used = async () => (await db.select().from(workspaceUsage)).map((r) => r.used);

describe("POST /api/w/[slug]/thanks/draft and the alliance's switches (D126)", () => {
  it("refuses while turned off or past the cap, and gives back only the language that failed", async () => {
    await db
      .insert(workspaceFeatures)
      .values({ workspaceId: 1, switches: { thanks_draft: false } });
    const off = await draft();
    expect([off.status, await off.json()]).toEqual([403, { code: "turned_off" }]);

    // Three languages do not fit a cap of 2: nothing is asked or counted.
    await db.update(workspaceFeatures).set({ switches: {}, caps: { ai: 2 } });
    const capped = await draft();
    expect([capped.status, await capped.json()]).toEqual([429, { code: "cap_reached" }]);
    expect(asked).toEqual([]);
    expect(await used()).toEqual([]);

    await db.update(workspaceFeatures).set({ caps: {} });
    expect((await draft()).status).toBe(429);
    // Each of the three languages was asked once.
    const languages = asked.map((user) => /^Write .* in (.+)\.\n/.exec(user)?.[1]);
    expect(languages.sort()).toEqual(["Brazilian Portuguese (pt-BR)", "English", "French"]);
    // English and Portuguese answered and stay counted; French failed and was given back.
    expect(await used()).toEqual([2]);
  });
});
