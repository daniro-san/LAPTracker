import { beforeEach, describe, expect, it, vi } from "vitest";

import { PUBLIC_WEBHOOK, testContext } from "./app-context.test-helpers";
import type { Db } from "./db";
import { eventImage } from "./event-image";
import { getEventDetail, memberTurnout, type TurnoutLists } from "./queries";
import { notifyFinished } from "./run-notify";

vi.mock("./queries", () => ({ getEventDetail: vi.fn(), memberTurnout: vi.fn() }));
vi.mock("./event-image", () => ({ eventImage: vi.fn() }));

const utc = (hhmm: string) => new Date(`2026-11-07T${hhmm}:00Z`);
const alliance = (unionId: number) => ({
  unionId,
  tag: "OGs",
  name: "OldGrandmas",
  isFresh: true,
  failed: false,
  totalPower: 1,
  totalKills: 1,
  memberCount: 100,
});
const lead = {
  unionId: 1,
  tag: "OGs",
  name: "OldGrandmas",
  badgeId: null,
  n: 100,
  gainers: 54,
  gained: 9,
  top: 3,
};
const lists: TurnoutLists = { withKills: [lead], topShare: [lead] };
const db = {} as Db;

async function finishAfter() {
  const { ctx, posts } = testContext(db);
  await notifyFinished(
    ctx,
    db,
    {
      event: {
        id: 9,
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
        snapshotId: 41,
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
  beforeEach(() => {
    vi.mocked(getEventDetail).mockResolvedValue({
      snapshots: [
        { id: 1, phase: "before", alliances: [alliance(1)] },
        { id: 2, phase: "after", alliances: [alliance(1)] },
      ],
    } as unknown as Awaited<ReturnType<typeof getEventDetail>>);
    vi.mocked(eventImage).mockResolvedValue(new Uint8Array([137, 80, 78, 71]));
  });

  it("gives the picture and the text the turnout of the End's snapshots", async () => {
    vi.mocked(memberTurnout).mockResolvedValue(lists);
    const sent = await finishAfter();
    expect(vi.mocked(eventImage).mock.calls.at(-1)?.[0].turnout).toBe(lists);
    expect(sent?.content).toContain("Most members with kills gained: [OGs] 54 %");
  });

  it("gives null and no line when the event has no turnout", async () => {
    vi.mocked(memberTurnout).mockResolvedValue(null);
    const sent = await finishAfter();
    expect(vi.mocked(eventImage).mock.calls.at(-1)?.[0].turnout).toBeNull();
    expect(sent?.content).not.toContain("Most members with kills gained");
  });
});
