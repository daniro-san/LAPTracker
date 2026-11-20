// Issue 471: two workspaces, each on its own Discord server (D126: a server has one workspace at most). A
// command is the workspace of the server it came from, for that server's leadership only; the same message on
// both servers is read once for each, against each alliance's own members. Invented ids only.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { saveWorkspace } from "../repo/workspaces";
import { screenshotDrafts } from "../schema-import";
import { recorded } from "../screenshot/test-helpers";
import {
  command,
  discord,
  GUILD,
  interactions,
  jobDeps,
  LEADER,
  seedOgs,
  signed,
} from "./discord-interaction.test-helpers";
import { runJob } from "./import-discord";

const THEIR_GUILD = "1544808864262914999";
const THEIR_LEADER = "1571951836724990777";
/** The same command, on the other workspace's server. */
const there = (roles: string[]) => ({ ...command(roles), guild_id: THEIR_GUILD });

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  await seedOgs(db);
  const saved = await saveWorkspace(db, {
    unionId: 900_002,
    slug: "bravo",
    discordGuildId: THEIR_GUILD,
    leaderRoleIds: [THEIR_LEADER],
  });
  expect(saved).toBe("ok");
});

const { handle, deferred } = interactions(() => db);

describe("two workspaces, each on its own Discord server (issue 471)", () => {
  it("refuses a second workspace on a server that already has one (D126)", async () => {
    const second = { unionId: 900_003, slug: "charlie", discordGuildId: GUILD, leaderRoleIds: [] };
    expect(await saveWorkspace(db, second)).toBe("guild_taken");
  });

  it("opens only the server's own workspace: another server's leadership role opens nothing", async () => {
    for (const payload of [
      command([THEIR_LEADER]),
      there([LEADER]),
      { ...command([LEADER]), guild_id: "1544808864262910000" },
    ]) {
      const handled = await handle(signed(payload));
      expect(handled).toMatchObject({ status: 200, body: { type: 4, data: { flags: 64 } } });
      expect("job" in handled).toBe(false);
    }
  });

  it("reads each server's message for its own workspace, against its own alliance's members only", async () => {
    // The same message id on both servers: each workspace claims it once, neither says "already sent".
    const ours = await deferred(command([LEADER]));
    const theirs = await deferred(there([THEIR_LEADER]));
    expect([ours.job.access.slug, theirs.job.access.slug]).toEqual(["ogs", "bravo"]);
    const replies: string[] = [];
    for (const job of [ours.job, theirs.job]) {
      const { calls, fetcher } = discord();
      await runJob(jobDeps(db, fetcher, recorded("98-alliance-duel-weekly-phone")), job);
      replies.push(JSON.parse(calls.find((c) => c.method === "PATCH")?.body ?? "{}").content);
    }
    const drafts = await db.select().from(screenshotDrafts);
    expect(drafts.map((d) => d.workspaceId)).toEqual([ours.job.access.workspaceId]);
    expect(replies[0]).toContain(`/w/ogs/shots/${drafts[0]?.id})`);
    // The picture lists OGs' members: none of them is matched in the other alliance, so nothing is saved.
    expect(replies[1]).toBe("Read: Alliance Duel, but no rows could be read. Nothing was saved.");
  });
});
