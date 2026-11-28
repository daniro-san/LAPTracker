import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { patchNotes } from "../patch-notes";
import { findWorkspaceBySlug, recordSignIn, saveWorkspace } from "../repo/workspaces";
import { FEATURES, type Feature } from "../workspace-features";
import { requireWorkspace, type WorkspaceAccess } from "./access";
import { createSession } from "./session";
import { openWhatsNew, whatsNew, whatsNewLine } from "./whats-new";

const OGS = 67111155;
const NOW = new Date("2026-11-27T12:00:00Z");

/** A workspace with every feature on except `off`. */
const withOff = (...off: Feature[]) => ({
  features: {
    on: new Set(FEATURES.filter((f) => !off.includes(f))),
    caps: { ai: 0, translate: 0 },
  },
});

describe("What's new (issue 782)", () => {
  it("lists only officer notes: a release without them stays on /admin/changes", () => {
    const adminOnly = patchNotes.filter((n) => !n.officer?.length).map((n) => n.version);
    expect(adminOnly.length).toBeGreaterThan(0);
    const listed = whatsNew(withOff(), "en");
    expect(listed.length).toBe(patchNotes.flatMap((n) => n.officer ?? []).length);
    for (const item of listed) expect(adminOnly).not.toContain(item.version);
  });

  it("leaves out a note about a feature the alliance does not have", () => {
    const about = (f: Feature) =>
      patchNotes.flatMap((n) => n.officer ?? []).filter((o) => o.needs?.includes(f));
    const titles = (off: Feature[]) => whatsNew(withOff(...off), "fr").map((i) => i.title);
    const insights = about("insights").map((o) => o.title.fr);
    expect(insights.length).toBeGreaterThan(0);
    expect(titles([])).toEqual(expect.arrayContaining(insights));
    for (const title of insights) expect(titles(["insights"])).not.toContain(title);
  });
});

describe("Home's What's new line (issue 782)", () => {
  let db: Db;
  beforeAll(async () => {
    db = await openTestDb();
  });
  beforeEach(async () => {
    await truncateAll(db);
    await saveWorkspace(db, {
      unionId: OGS,
      slug: "ogs",
      discordGuildId: "1",
      leaderRoleIds: ["2"],
    });
  });

  async function officer(discordId: string): Promise<WorkspaceAccess> {
    const ws = await findWorkspaceBySlug(db, "ogs");
    const userId = await recordSignIn(db, ws?.id ?? 0, discordId, "Ana", NOW);
    const { token } = await createSession(db, ws?.id ?? 0, userId, NOW, null, "officer");
    const access = await requireWorkspace(db, "ogs", { get: () => ({ value: token }) }, NOW);
    if (!access.ok) throw new Error("no access");
    return access;
  }

  it("names the newest note until the officer opens What's new, then goes away", async () => {
    const ana = await officer("officer-ana");
    const [newest] = whatsNew(ana, "pt-BR");
    expect((await whatsNewLine(db, ana))?.["pt-BR"]).toBe(newest?.title);
    expect((await openWhatsNew(db, ana, "pt-BR"))[0]).toEqual(newest);
    expect(await whatsNewLine(db, ana)).toBeNull();
  });

  it("is seen per officer: one officer opening it leaves it on another's Home", async () => {
    const ana = await officer("officer-ana");
    const bea = await officer("officer-bea");
    await openWhatsNew(db, ana, "en");
    expect(await whatsNewLine(db, ana)).toBeNull();
    expect((await whatsNewLine(db, bea))?.en).toBe(whatsNew(bea, "en")[0]?.title);
  });
});
