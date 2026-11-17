import { randomUUID } from "node:crypto";

import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { findWorkspaceBySlug, recordSignIn, saveWorkspace } from "../repo/workspaces";
import { requireBoard, requireWorkspace, type WorkspaceAccess } from "./access";
import { boardView } from "./board";
import { createEntry } from "./calendar";
import { newEntry } from "./calendar-model";
import { saveNotice } from "./notices";
import { createSession } from "./session";
import { saveStartHere } from "./start-here";

/** Monday, Nov 16, 10:00 server time. */
const NOW = new Date("2026-11-16T12:00:00Z");
const TODAY = "2026-11-16";

let db: Db;
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
  });
});

async function session(name: string, tier: "officer" | "member") {
  const ws = await findWorkspaceBySlug(db, "ogs");
  const userId = await recordSignIn(db, ws?.id ?? 0, `id-${name}`, name, NOW);
  return (await createSession(db, ws?.id ?? 0, userId, NOW, null, tier)).token;
}

async function officer(name: string): Promise<WorkspaceAccess> {
  const token = await session(name, "officer");
  const access = await requireWorkspace(db, "ogs", { get: () => ({ value: token }) }, NOW);
  if (!access.ok) throw new Error("no access");
  return access;
}

async function notice(by: WorkspaceAccess, title: string, forMembers: boolean, endsOn: string) {
  const changes = [
    { field: "title" as const, value: title, version: 0 },
    { field: "en" as const, value: `${title} in English`, version: 0 },
    { field: "for_members" as const, value: String(forMembers), version: 0 },
    { field: "ends_on" as const, value: endsOn, version: 0 },
  ];
  const saved = await saveNotice(db, by, null, changes, NOW, randomUUID());
  if (!saved.ok) throw new Error("notice not saved");
  return saved.id;
}

const entry = (by: WorkspaceAccess, input: Record<string, unknown>) =>
  createEntry(db, by, newEntry.parse(input), randomUUID());

describe("the members' board (D105)", () => {
  it("shows only what officers marked for members, from today, with nothing about any person", async () => {
    const ana = await officer("Ana");
    const plan = await notice(ana, "KvK plan", false, "");
    const shown = await notice(ana, "Caravan times", true, "2026-11-20");
    await notice(ana, "Last week", true, "2026-11-15");
    await entry(ana, { kind: "duel", day: TODAY, title: "Tech", forMembers: true });
    await entry(ana, {
      kind: "caravan",
      day: "2026-11-18",
      minute: 600,
      notes: "Be early",
      forMembers: true,
      notice: plan,
    });
    await entry(ana, { kind: "other", day: "2026-11-19", minute: 60, title: "KvK prep" });
    await entry(ana, {
      kind: "other",
      day: "2026-11-15",
      minute: 60,
      title: "Yesterday",
      forMembers: true,
    });

    const token = await session("Rio", "member");
    const access = await requireBoard(db, "ogs", { get: () => ({ value: token }) }, NOW);
    if (!access.ok) throw new Error("no board");
    const view = await boardView(db, access, TODAY);

    expect(
      view.entries.map((e) => [e.day, e.minute, e.entry.kind, e.entry.notes, e.noticeId]),
    ).toEqual([
      [TODAY, null, "duel", null, null],
      // Linked to a leadership notice: the link is left out.
      ["2026-11-18", 600, "caravan", "Be early", null],
    ]);
    expect(view.notices).toEqual([
      {
        id: shown,
        title: "Caravan times",
        endsOn: "2026-11-20",
        texts: { en: "Caravan times in English" },
      },
    ]);
    expect(JSON.stringify(view)).not.toMatch(/Ana|createdBy|coach|edits/);
  });

  it("keeps Start here per language: two officers' languages both stay, a stale one is refused", async () => {
    const [ana, bo] = [await officer("Ana"), await officer("Bo")];
    const text = (rules: string) => ({ glossary: "EB: Elite Boss", rules, ask: "" });
    expect(
      await saveStartHere(
        db,
        ana,
        { changes: [{ language: "en", version: 0, text: text("Be kind.") }] },
        NOW,
      ),
    ).toEqual({ ok: true, version: 1 });
    expect(
      await saveStartHere(
        db,
        bo,
        { changes: [{ language: "pt-BR", version: 0, text: text("Seja gentil.") }] },
        NOW,
      ),
    ).toEqual({ ok: true, version: 2 });
    expect(
      await saveStartHere(
        db,
        bo,
        { changes: [{ language: "en", version: 0, text: text("Mine") }] },
        NOW,
      ),
    ).toEqual({
      ok: false,
      conflicts: [{ language: "en", by: "Ana", at: NOW.toISOString() }],
    });

    const token = await session("Rio", "member");
    const access = await requireBoard(db, "ogs", { get: () => ({ value: token }) }, NOW);
    if (!access.ok) throw new Error("no board");
    expect((await boardView(db, access, TODAY)).startHere).toEqual({
      en: text("Be kind."),
      "pt-BR": text("Seja gentil."),
    });
  });
});
