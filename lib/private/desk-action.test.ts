// The desk's writes as `ws_action` (D115): counted on success only, on the pseudonymous id, enums only.
import { afterEach, describe, expect, it, vi } from "vitest";

import { analyticsPersonId } from "../analytics/person";
import type { WorkspaceAccess } from "./access";
import { counted } from "./desk-action";

const SECRET = "s".repeat(32);
const ACCESS = {
  ok: true,
  workspaceId: 1,
  unionId: 67111155,
  slug: "ogs",
  user: { id: 42, displayName: "Wren", playerUid: 900 },
} as unknown as WorkspaceAccess;

afterEach(() => vi.restoreAllMocks());

describe("counted (D115, issue 452)", () => {
  it("sends feature, action, workspace and alliance on the officer's pseudonymous id for a success, nothing for a refusal", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response("{}"));
    const ctx = {
      env: { CRON_SECRET: SECRET, VERCEL_ENV: "production", POSTHOG_KEY: "phc_test" },
      fetch: fetcher,
    } as unknown as Parameters<typeof counted>[0];
    const ok = Response.json({ ok: true });
    expect(counted(ctx, ACCESS, "calendar", "add", ok)).toBe(ok);
    counted(ctx, ACCESS, "calendar", "add", Response.json({ code: "x" }, { status: 409 }));
    await new Promise((r) => setTimeout(r, 0));
    expect(fetcher).toHaveBeenCalledTimes(1);
    const sent = JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body)) as {
      batch: { event: string; distinct_id: string; properties: Record<string, unknown> }[];
    };
    const [event] = sent.batch;
    expect(event?.event).toBe("ws_action");
    expect(event?.distinct_id).toBe(analyticsPersonId(42, SECRET));
    expect(event?.properties).toEqual({
      $lib: "laptracker-server",
      area: "workspace",
      feature: "calendar",
      action: "add",
      tier: "officer",
      workspace: "ogs",
      alliance: "OGs",
    });
    expect(JSON.stringify(sent)).not.toMatch(/Wren|"42"|900/);
  });
});
