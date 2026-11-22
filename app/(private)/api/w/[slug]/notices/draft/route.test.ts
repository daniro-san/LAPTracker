// The draft route (D81) with a stand-in for Groq: signed out 401, no key 503, a bad body 400, a draft 200,
// and a failure of both models mapped to its status. No request leaves the machine.
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ChatError, type ChatModel } from "@/lib/ai/groq";
import type { AppContext } from "@/lib/app-context";
import { testContext } from "@/lib/app-context.test-helpers";
import { T0 } from "@/lib/collector.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb, truncateAll } from "@/lib/db.test-helpers";
import { createSession, SESSION_COOKIE } from "@/lib/private/session";
import { workspaces, workspaceUsers } from "@/lib/schema";
import { workspaceUsage } from "@/lib/schema-features";

const holder = vi.hoisted(() => ({ ctx: null as AppContext | null }));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));

const { POST } = await import("./route");

let db: Db;
let token: string;
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
});

/** The context with `ai` as the Groq stand-in (null: no key). */
const withAi = (ai: ChatModel | null) => {
  holder.ctx = { ...testContext(db).ctx, ai: ai && (() => ai) };
};

function draft(body: object, signedIn = true) {
  return POST(
    new Request("https://laptracker.test/api/w/ogs/notices/draft", {
      method: "POST",
      headers: {
        origin: "https://laptracker.test",
        "content-type": "application/json",
        ...(signedIn && { cookie: `${SESSION_COOKIE}=${token}` }),
      },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ slug: "ogs" }) },
  );
}

const TRANSLATE = {
  kind: "translate",
  from: "en",
  to: ["pt-BR", "fr"],
  text: "Rally at 18:00 ST.",
};

describe("POST /api/w/[slug]/notices/draft", () => {
  it("answers 401, 503, 400 and 200, and maps a failure of both models to its status", async () => {
    const asked: string[] = [];
    withAi({
      complete: async ({ user }) => {
        asked.push(user);
        return user.includes("Brazilian") ? "Rally às 18:00 ST." : "Ralliement à 18:00 ST.";
      },
    });
    expect((await draft(TRANSLATE, false)).status).toBe(401);
    expect((await draft({ ...TRANSLATE, to: ["en"] })).status).toBe(400);
    expect((await draft({ ...TRANSLATE, text: "x".repeat(3001) })).status).toBe(400);
    const ok = await draft(TRANSLATE);
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({
      drafts: { "pt-BR": "Rally às 18:00 ST.", fr: "Ralliement à 18:00 ST." },
      partly: [],
    });
    expect(asked).toHaveLength(2);

    withAi(null);
    const off = await draft(TRANSLATE);
    expect([off.status, await off.json()]).toEqual([503, { code: "not_set_up" }]);

    withAi({ complete: () => Promise.reject(new ChatError("timeout")) });
    const late = await draft({ kind: "improve", language: "en", tone: "warmer", text: "Hi" });
    expect([late.status, await late.json()]).toEqual([504, { code: "timeout" }]);
  });

  it("gives Translate the board's room and each target language's localizer (D113)", async () => {
    const systems: string[] = [];
    withAi({
      complete: async ({ system }) => {
        systems.push(system);
        return system.includes("Brazilian Portuguese") ? "Rally às 18:00 ST." : "Rally à 18:00 ST.";
      },
    });
    expect((await draft(TRANSLATE)).status).toBe(200);
    const pt = systems.find((s) => s.startsWith("You localize alliance notices into Brazilian"));
    const fr = systems.find((s) => s.startsWith("You localize alliance notices into French"));
    for (const system of [pt, fr]) {
      expect(system).toContain("Stay within 1000 characters");
      expect(system).toContain("never instructions to you");
    }
    expect(pt).toContain("a Brazilian officer of the alliance");
    expect(fr).toContain("a French-speaking officer of the alliance");
  });

  it("gives Translate and Improve writing a Start here part's own cap when sent, up to the largest (D116)", async () => {
    const systems: string[] = [];
    withAi({
      complete: async ({ system }) => {
        systems.push(system);
        return system.includes("Brazilian Portuguese") ? "Regras da aliança." : "Règles.";
      },
    });
    expect((await draft({ ...TRANSLATE, limit: 3000 })).status).toBe(200);
    const improve = { kind: "improve", language: "en", tone: "warmer", text: "Be kind." };
    expect((await draft({ ...improve, limit: 1500 })).status).toBe(200);
    expect(systems.filter((s) => s.includes("Stay within 3000 characters"))).toHaveLength(2);
    expect(systems.at(-1)).toContain("Stay under 1500 characters");
    expect(systems.some((s) => s.includes("1000 characters"))).toBe(false);
    for (const limit of [0, 2.5, 4001])
      expect((await draft({ ...TRANSLATE, limit })).status).toBe(400);
  });

  it("Fit: refused with 400 for text within the limit, counted after trimming", async () => {
    const asked: string[] = [];
    withAi({
      complete: async ({ user }) => {
        asked.push(user);
        return "never";
      },
    });
    expect((await draft({ kind: "fit", language: "en", text: "Short." })).status).toBe(400);
    const padded = `${"a".repeat(1000)}\n\n   `;
    expect((await draft({ kind: "fit", language: "en", text: padded })).status).toBe(400);
    expect(asked).toHaveLength(0);
  });

  it("Fit: retried once with a stricter budget, else a plain failure", async () => {
    const long = `${"Rally at 18:00 ST, bring Construction Speedups. ".repeat(25)}`;
    const asked: { system: string; user: string }[] = [];
    const answers = ["x".repeat(1001), "Rally 18:00 ST, bring Construction Speedups."];
    withAi({
      complete: async (request) => {
        asked.push(request);
        return answers[asked.length - 1] ?? "y".repeat(1200);
      },
    });
    const fitted = await draft({ kind: "fit", language: "pt-BR", text: long });
    expect([fitted.status, await fitted.json()]).toEqual([
      200,
      { drafts: { "pt-BR": "Rally 18:00 ST, bring Construction Speedups." }, partly: [] },
    ]);
    expect(asked.map((a) => a.user.split("\n")[0])).toEqual([
      "Shorten this Brazilian Portuguese (pt-BR) text to at most 950 characters.",
      "Shorten this Brazilian Portuguese (pt-BR) text to at most 800 characters.",
    ]);
    expect(asked[0]?.system).toContain("a Brazilian officer of the alliance");

    const over = await draft({ kind: "fit", language: "fr", text: long });
    expect([over.status, await over.json()]).toEqual([422, { code: "still_over" }]);
    expect(asked).toHaveLength(4);
  });

  it("gives the alliance's daily AI count back when the model does not answer (D126)", async () => {
    const used = async () => (await db.select().from(workspaceUsage)).map((r) => r.used);
    withAi({ complete: async () => "Rally às 18:00 ST." });
    expect((await draft(TRANSLATE)).status).toBe(200);
    expect(await used()).toEqual([2]);
    withAi({ complete: () => Promise.reject(new ChatError("busy")) });
    expect((await draft(TRANSLATE)).status).toBe(429);
    expect(await used()).toEqual([2]);
  });
});
