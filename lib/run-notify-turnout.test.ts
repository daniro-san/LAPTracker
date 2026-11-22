// The End's public message carries the turnout line (#276), read from the event's Start and End rosters on
// PGlite, while the war-turnout flag is on (D91). Invented names only.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { PUBLIC_WEBHOOK, TEST_ENV, testContext } from "./app-context.test-helpers";
import type { Db } from "./db";
import { openTestDb, truncateAll } from "./db.test-helpers";
import { notifyFinished } from "./run-notify";
import { allianceSnapshots, events, memberSnapshots, snapshots } from "./schema";

const utc = (hhmm: string) => new Date(`2026-11-07T${hhmm}:00Z`);
// The war turnout is sent only while its flag is on (D91); without a PostHog key, LOCAL_FLAGS turns it on.
const FLAG_ON = { ...TEST_ENV, LOCAL_FLAGS: "war-turnout" };
const LINE = "Most members with kills gained";

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(() => truncateAll(db));

/** Saturday 2026-11-07's event with OGs' Start and End rosters: each member's kills, Start then End. */
async function seedEvent(kills: [number, number][]) {
  const [event] = await db
    .insert(events)
    .values({
      name: "Saturday Event 2026-11-07",
      eventAtUtc: utc("14:00"),
      allianceIds: [1],
      beforeAt: utc("12:00"),
      afterAt: utc("16:00"),
    })
    .returning({ id: events.id });
  const eventId = event?.id ?? 0;
  for (const [i, phase] of (["before", "after"] as const).entries()) {
    const [snap] = await db
      .insert(snapshots)
      .values({
        eventId,
        phase,
        startedAt: utc(phase === "before" ? "12:00" : "16:00"),
        status: "complete",
      })
      .returning({ id: snapshots.id });
    const [alliance] = await db
      .insert(allianceSnapshots)
      .values({
        snapshotId: snap?.id ?? 0,
        unionId: 1,
        tag: "OGs",
        name: "OldGrandmas",
        source: "v1",
        isFresh: true,
      })
      .returning({ id: allianceSnapshots.id });
    await db.insert(memberSnapshots).values(
      kills.map((k, n) => ({
        allianceSnapshotId: alliance?.id ?? 0,
        uid: 100 + n,
        name: `Invented ${n}`,
        lv: 20,
        power: 1_000_000,
        kills: k[i],
      })),
    );
  }
  return eventId;
}

/** The End's run finishing; returns the public message as Discord got it. */
async function finishAfter(eventId: number, env: typeof TEST_ENV = FLAG_ON) {
  const { ctx, posts } = testContext(db, env);
  await notifyFinished(
    ctx,
    db,
    {
      event: {
        id: eventId,
        name: "Saturday Event 2026-11-07",
        isTest: false,
        manual: false,
        postPublic: false,
        discordPublicMessageId: null,
        discordAdminMessageId: null,
        eventAtUtc: utc("14:00"),
        beforeAt: utc("12:00"),
        afterAt: utc("16:00"),
      },
      phase: "after",
      origin: "https://lap.test",
    },
    {
      summary: {
        snapshotId: 2,
        phase: "after",
        status: "complete",
        callsUsed: 21,
        quotaRemainingAfter: 779,
        durationMs: 52_000,
        error: null,
        stale: [],
        failed: [],
      },
      startedAt: utc("16:00"),
      logWriteFailures: 0,
    },
  );
  return posts.find((p) => p.url === PUBLIC_WEBHOOK);
}

describe("the End's turnout in the public message (#276)", () => {
  it("names the alliance and the share of its members whose kills rose", async () => {
    // Two of four members gained kills between the Start and the End.
    const eventId = await seedEvent([
      [10, 15],
      [10, 10],
      [10, 12],
      [10, 10],
    ]);
    const sent = await finishAfter(eventId);
    expect(sent?.content).toContain(`${LINE}: [OGs] 50 %`);
  });

  it("has no turnout line when no member's kills rose", async () => {
    const eventId = await seedEvent([
      [10, 10],
      [12, 12],
    ]);
    const sent = await finishAfter(eventId);
    expect(sent?.content).toContain("1/1 alliances");
    expect(sent?.content).not.toContain(LINE);
  });

  it("has no turnout line while the war-turnout flag is off (D91)", async () => {
    const eventId = await seedEvent([
      [10, 15],
      [10, 12],
    ]);
    const sent = await finishAfter(eventId, TEST_ENV);
    expect(sent?.content).toContain("1/1 alliances");
    expect(sent?.content).not.toContain(LINE);
  });
});
