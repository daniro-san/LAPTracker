// Alliance settings → Your line on our posts (#713, D156) against a real Postgres (PGlite): an officer's line
// is saved cleaned and read back, 120 graphemes and no more, a save of the same text changes nothing and
// adds no Home line, a change is a Home line without the text, and with `post_callouts` off nothing is
// saved or shown while the saved lines stay. Invented names only.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { CALLOUT_LIMIT } from "../post-callout";
import { calloutOf } from "../repo/post-touches";
import { setAllianceSwitch } from "../repo/workspace-features";
import { findWorkspaceBySlug, recordSignIn, saveWorkspace } from "../repo/workspaces";
import { requireWorkspace, type WorkspaceAccess } from "./access";
import { linesOf, recentActivity } from "./desk-activity.test-helpers";
import { WORKSPACE_DICTIONARIES } from "./dictionary";
import { calloutsView, postCallout, saveCalloutFor } from "./post-callouts";
import { createSession } from "./session";

const NOW = new Date("2026-11-22T12:00:00Z"); // Sun 10:00 ST
const t = WORKSPACE_DICTIONARIES.en;

let db: Db;
let ws = 0;
let token = "";
let access: WorkspaceAccess;
beforeAll(async () => {
  db = await openTestDb();
});

const signIn = async () => {
  const signed = await requireWorkspace(db, "nse", { get: () => ({ value: token }) }, NOW);
  if (!signed.ok) throw new Error("no access");
  return signed;
};

beforeEach(async () => {
  await truncateAll(db);
  await saveWorkspace(db, {
    unionId: 67109944,
    slug: "nse",
    discordGuildId: "1",
    leaderRoleIds: ["2"],
    memberRoleIds: ["3"],
  });
  ws = (await findWorkspaceBySlug(db, "nse"))?.id ?? 0;
  const userId = await recordSignIn(db, ws, "nse-ana", "Ana", NOW);
  ({ token } = await createSession(db, ws, userId, NOW, null, "officer"));
  access = await signIn();
});

const save = (post: "shield" | "thanks" | "garrison", callout: string, at = NOW) =>
  saveCalloutFor(db, access, { post, callout }, at);

describe("the alliance's own line on our posts (D156)", () => {
  it("is saved as one clean line and read back on the card and by the post", async () => {
    expect(await save("thanks", "  Thank you,\n  family  ")).toEqual({
      ok: true,
      callout: "Thank you, family",
      changed: true,
    });
    const view = await calloutsView(db, access, t, null);
    expect(view?.find((r) => r.post === "thanks")).toEqual({
      post: "thanks",
      callout: "Thank you, family",
      title: "Weekly appreciation",
    });
    expect(await postCallout(db, access, "thanks")).toBe("Thank you, family");
    // Clearing it leaves the post without a line.
    expect((await save("thanks", "   ")).ok).toBe(true);
    expect(await postCallout(db, access, "thanks")).toBe("");
  });

  it("holds 120 graphemes, an emoji with its skin tone as one, and refuses the 121st", async () => {
    const full = `${"a".repeat(CALLOUT_LIMIT - 1)}👍🏽`;
    expect((await save("garrison", full)).ok).toBe(true);
    expect(await save("garrison", `${full}a`)).toEqual({ ok: false, code: "too_long" });
    expect(await calloutOf(db, ws, "garrison")).toBe(full);
  });

  it("says on Home who changed which post's line, never the text, and a same-text save adds nothing", async () => {
    await save("shield", "Shields up, family");
    const again = await save("shield", "Shields up, family", new Date(NOW.getTime() + 60_000));
    expect(again).toEqual({ ok: true, callout: "Shields up, family", changed: false });
    const lines = await recentActivity(db, access, new Date(NOW.getTime() + 120_000));
    expect(linesOf(lines)).toEqual(["Ana changed the line on the Raid Shield summary"]);
    // The line keeps the time of the change, not of the same-text save.
    expect(lines[0]?.item.at).toEqual(NOW);
    expect(JSON.stringify(lines)).not.toContain("Shields up");
  });

  it("with the switch off, saves nothing, shows no card, and posts carry no line; the line stays", async () => {
    await save("thanks", "Thank you, family");
    await setAllianceSwitch(db, ws, "post_callouts", false, NOW);
    access = await signIn();
    expect(await save("thanks", "Another line")).toEqual({ ok: false, code: "turned_off" });
    expect(await calloutsView(db, access, t, null)).toBeNull();
    expect(await postCallout(db, access, "thanks")).toBe("");
    await setAllianceSwitch(db, ws, "post_callouts", true, NOW);
    access = await signIn();
    expect(await postCallout(db, access, "thanks")).toBe("Thank you, family");
  });
});
