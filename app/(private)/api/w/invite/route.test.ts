// POST /api/w/invite (D130, issue 486): "finish" makes the workspace and counts it as `ws_action`
// `workspace` / `create` on the new officer's pseudonymous id, with the workspace and its alliance only.
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { analyticsPersonId } from "@/lib/analytics/person";
import type { AppContext } from "@/lib/app-context";
import { testContext } from "@/lib/app-context.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb, truncateAll } from "@/lib/db.test-helpers";
import { inviteStep } from "@/lib/private/invite-steps";
import {
  deps,
  discord,
  env,
  GUILD,
  HER,
  MEMBER_ROLE,
  openedInvite,
  ORIGIN,
  R5_ROLE,
  signInThrough,
  stub,
} from "@/lib/private/invite.test-helpers";
import { workspaceUsers } from "@/lib/schema";

const holder = vi.hoisted(() => ({ ctx: null as AppContext | null }));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));

const route = await import("./route");

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  discord.reset();
});

describe("the invite's finish (issue 486)", () => {
  it("counts the workspace made on her pseudonymous id, with the workspace and alliance only", async () => {
    const analyticsEnv = { ...env, VERCEL_ENV: "production", POSTHOG_KEY: "phc_test" };
    const ctx = testContext(db, analyticsEnv).ctx;
    const payloads: string[] = [];
    ctx.fetch = async (input, init) => {
      if (String(init?.body ?? "").includes("ws_action")) {
        payloads.push(String(init?.body));
        return Response.json({});
      }
      return stub(input, init);
    };
    holder.ctx = ctx;
    const b = await openedInvite(db);
    await signInThrough(db, b);
    await inviteStep(db, deps(), b.jar, { action: "server", guild_id: GUILD });
    const cookie = [...b.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
    const res = await route.POST(
      new Request(`${ORIGIN}/api/w/invite`, {
        method: "POST",
        headers: { origin: ORIGIN, "content-type": "application/json", cookie },
        body: JSON.stringify({
          action: "finish",
          leader_role_ids: [R5_ROLE],
          member_role_ids: [MEMBER_ROLE],
        }),
      }),
    );
    expect(res.status).toBe(200);
    await vi.waitFor(() => expect(payloads).toHaveLength(1));
    const [her] = await db.select().from(workspaceUsers);
    const [event] = (
      JSON.parse(payloads[0] ?? "") as {
        batch: { event: string; distinct_id: string; properties: Record<string, unknown> }[];
      }
    ).batch;
    expect(event?.event).toBe("ws_action");
    expect(event?.distinct_id).toBe(analyticsPersonId(her?.id ?? 0, env.CRON_SECRET));
    expect(event?.properties).toMatchObject({
      feature: "workspace",
      action: "create",
      workspace: "wack",
    });
    expect(payloads[0]).not.toContain(HER);
    expect(payloads[0]).not.toContain(GUILD);
  });
});
