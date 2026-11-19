// The daily job of D125: a workspace whose 14 days ended is deleted from every table it owns, in one go,
// and leaves a tombstone; another workspace and the public rosters stay. The list of owned tables covers
// every table with a workspace_id column, so a table added later cannot be left behind.
import { count, getTableColumns, getTableName, is } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import * as schema from "../schema";
import * as board from "../schema-board";
import * as features from "../schema-features";
import * as imports from "../schema-import";
import * as keys from "../schema-keys";
import * as notices from "../schema-notices";
import * as retention from "../schema-retention";
import * as squads from "../schema-squads";
import * as thefts from "../schema-thefts";
import { seedEverything, seedRoster, seedWorkspace, SEED_AT } from "../workspace-data.test-helpers";
import { ownedBy, WORKSPACE_TABLES } from "./workspace-data";
import {
  askDeletion,
  cancelDeletion,
  DELETION_GRACE_MS,
  purgeDueWorkspaces,
  purgeWorkspace,
} from "./workspace-purge";

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
});

const later = (ms: number) => new Date(SEED_AT.getTime() + ms);

/** How many rows each owned table holds for the workspace, by table name. */
async function rowsOf(ws: { id: number; unionId: number }) {
  const out: Record<string, number> = {};
  for (const t of WORKSPACE_TABLES) {
    const [row] = await db.select({ n: count() }).from(t.table).where(ownedBy(t, ws));
    out[getTableName(t.table)] = row?.n ?? 0;
  }
  return out;
}

describe("the workspace purge (D125)", () => {
  it("lists every table with a workspace_id column, or a foreign key into a listed table", () => {
    const modules = [schema, board, features, imports, keys, notices, retention, squads, thefts];
    const tables = [
      ...new Set(modules.flatMap((m) => Object.values(m).filter((v) => is(v, PgTable)))),
    ];
    const owned = new Set<unknown>(WORKSPACE_TABLES.map((t) => t.table));
    const pointsIn = (t: PgTable) =>
      getTableConfig(t).foreignKeys.some((fk) => owned.has(fk.reference().foreignTable));
    const missing = tables.filter(
      (t) =>
        !owned.has(t) &&
        (Object.values(getTableColumns(t)).some((c) => c.name === "workspace_id") || pointsIn(t)),
    );
    expect(missing.map(getTableName)).toEqual([]);
  });

  it("keeps a workspace whose deletion was cancelled after the job listed it", async () => {
    const nse = await seedWorkspace(db, "nse", 67109944);
    await askDeletion(db, nse.workspaceId, nse.officer, SEED_AT);
    // The job listed it as due; an officer cancels before its transaction locks the row.
    await cancelDeletion(db, nse.workspaceId);
    expect(await purgeWorkspace(db, nse.workspaceId, later(DELETION_GRACE_MS))).toBeNull();
    expect(await db.select({ slug: schema.workspaces.slug }).from(schema.workspaces)).toEqual([
      { slug: "nse" },
    ]);
    expect(await db.select().from(retention.workspaceTombstones)).toEqual([]);
  });

  it("deletes every owned row after the 14 days, leaves a tombstone, and touches nothing else", async () => {
    const nse = await seedWorkspace(db, "nse", 67109944);
    const ogs = await seedWorkspace(db, "ogs", 67111155);
    await seedRoster(db, nse.unionId);
    await seedEverything(db, nse);
    await seedEverything(db, ogs);
    await askDeletion(db, nse.workspaceId, nse.officer, SEED_AT);
    const a = { id: nse.workspaceId, unionId: nse.unionId };
    const b = { id: ogs.workspaceId, unionId: ogs.unionId };
    // Every owned table has a row to delete, so the check below means something.
    expect(Object.entries(await rowsOf(a)).filter(([, n]) => n === 0)).toEqual([]);

    expect(await purgeDueWorkspaces(db, later(DELETION_GRACE_MS - 60_000))).toEqual({
      workspaces: 0,
      rows: 0,
      failed: [],
    });
    const done = await purgeDueWorkspaces(db, later(DELETION_GRACE_MS));
    expect(done.workspaces).toBe(1);
    expect(done.rows).toBeGreaterThan(WORKSPACE_TABLES.length);

    expect(Object.entries(await rowsOf(a)).filter(([, n]) => n > 0)).toEqual([]);
    expect(Object.entries(await rowsOf(b)).filter(([, n]) => n === 0)).toEqual([]);
    expect(await db.select({ slug: schema.workspaces.slug }).from(schema.workspaces)).toEqual([
      { slug: "ogs" },
    ]);
    // Public data stays: the roster of the deleted workspace's alliance.
    expect(await db.select({ n: count() }).from(schema.dailyRosters)).toEqual([{ n: 1 }]);
    const tombstones = await db.select().from(retention.workspaceTombstones);
    expect(tombstones).toEqual([
      {
        id: 1,
        slug: "nse",
        unionId: 67109944,
        alliance: expect.stringContaining("·") as string,
        byOwner: false,
        requestedAt: SEED_AT,
        purgedAt: later(DELETION_GRACE_MS),
      },
    ]);
    // A second run finds nothing more to do.
    expect((await purgeDueWorkspaces(db, later(DELETION_GRACE_MS + 86_400_000))).workspaces).toBe(
      0,
    );
  });
});
