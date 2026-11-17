// D110: the type of a tab's button. It starts only a picture the classifier does not recognise; a picture it
// recognises keeps its own type, and a map stays a map.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { findWorkspaceBySlug, recordSignIn, saveWorkspace } from "../repo/workspaces";
import { classifyScreen } from "../screenshot/classify";
import { recorded } from "../screenshot/test-helpers";
import { requireWorkspace, type WorkspaceAccess } from "./access";
import { createDrafts } from "./import";
import { createSession } from "./session";

const NOW = new Date("2026-11-16T12:00:00Z");
const sent = { source: "desk" as const, sentBy: "Ana", pictureDay: "2026-11-16", now: NOW };
const pictureOf = (lines: string[]) => [{ lines, classified: classifyScreen(lines) }];
const memberUpdate = { kind: "member_update" as const, scope: null };

let db: Db;
let ana: WorkspaceAccess;
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
  const ws = await findWorkspaceBySlug(db, "ogs");
  const userId = await recordSignIn(db, ws?.id ?? 0, "1", "Ana", NOW);
  const { token } = await createSession(db, ws?.id ?? 0, userId, NOW, null, "officer");
  const access = await requireWorkspace(db, "ogs", { get: () => ({ value: token }) }, NOW);
  if (!access.ok) throw new Error("no access");
  ana = access;
});

describe("a tab's preset type (D110)", () => {
  it("starts a picture the classifier does not recognise as the preset", async () => {
    // One invented message: too few sender lines for the classifier to call it a chat.
    const chat = ["WA XX. 27 ¢ [0Gs] Ana", "Main squad 12.3 M", "AD Tech 55%"];
    expect((await createDrafts(db, ana, pictureOf(chat), sent)).outcomes).toEqual([
      { status: "unrecognised" },
    ]);
    const made = await createDrafts(db, ana, pictureOf(chat), sent, undefined, memberUpdate);
    expect(made.drafts).toMatchObject([{ kind: "member_update", rows: 2 }]);
  });

  it("keeps a recognised picture's own type, and a map stays a map", async () => {
    const duel = recorded("27-alliance-duel-weekly-mine");
    const map = ["0/s 15 8 12 0/s", "#325 [OGs] Bramble", "#325 [OGs] Thimble", "Map"];
    const made = await createDrafts(
      db,
      ana,
      [...pictureOf(duel), ...pictureOf(map)],
      sent,
      undefined,
      memberUpdate,
    );
    expect(made.drafts).toMatchObject([{ kind: "alliance_duel", scope: "weekly" }]);
    expect(made.outcomes).toEqual([{ status: "draft", draft: 0 }, { status: "map" }]);
  });
});
