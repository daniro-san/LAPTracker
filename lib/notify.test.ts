import { describe, expect, it } from "vitest";

import { ADMIN_WEBHOOK, PUBLIC_WEBHOOK, TEST_ENV, TEST_PIN } from "./app-context.test-helpers";
import type { RunSummary } from "./collector";
import {
  adminSnapshotMessage,
  appErrorMessage,
  createNotifier,
  discordClock,
  pinLockedMessage,
  publicSnapshotMessage,
  quotaReportMessage,
  rehearsalSkippedMessage,
  rehearsalVerdictMessage,
  type PublicAlliance,
  type PublicContext,
} from "./notify";
import { BLOCKED_ROSTER_KEYS, findBlockedKeys } from "./queries";

// TEST_ENV's SERVER_TZ is Etc/GMT+2: 16:01 UTC is 14:01 server time.
const clock = discordClock(TEST_ENV.SERVER_TZ);
const utc = (hhmm: string) => new Date(`2026-11-07T${hhmm}:00Z`);

const summary = (over: Partial<RunSummary> = {}): RunSummary => ({
  snapshotId: 41,
  phase: "after",
  status: "complete",
  callsUsed: 21,
  quotaRemainingAfter: 779,
  durationMs: 52_000,
  error: null,
  stale: [],
  failed: [],
  ...over,
});

const alliance = (
  unionId: number,
  tag: string,
  name: string,
  power: number,
  kills: number,
  over: Partial<PublicAlliance> = {},
): PublicAlliance => ({
  unionId,
  tag,
  name,
  isFresh: true,
  failed: false,
  totalPower: power,
  totalKills: kills,
  ...over,
});

const BEFORE = [
  alliance(1, "OGs", "OldGrandmas", 4_290_000_000, 60_000_000),
  alliance(2, "NSE", "Natural Selection", 3_000_000_000, 61_000_000),
  alliance(3, "URSA", "Ursa", 3_810_000_000, 30_600_000),
  alliance(4, "WACK", "TheWackyOnes", 2_000_000_000, 10_000_000),
];
const AFTER = [
  alliance(1, "OGs", "OldGrandmas", 4_375_800_000, 60_100_000),
  alliance(2, "NSE", "Natural Selection", 3_010_000_000, 62_710_000),
  alliance(3, "URSA", "Ursa", 3_738_700_000, 29_570_000),
  alliance(4, "WACK", "TheWackyOnes", 2_001_000_000, 10_000_500),
];

const publicCtx = (over: Partial<PublicContext> = {}): PublicContext => ({
  clock,
  eventUrl: "https://lap.test/events/9",
  finishedAt: utc("16:01"),
  nextAt: null,
  alliances: AFTER,
  before: BEFORE,
  ...over,
});

describe("public snapshot message", () => {
  it("before snapshot done: the status chip, the count and the next update", () => {
    const embed = publicSnapshotMessage(
      summary({ phase: "before" }),
      publicCtx({
        finishedAt: utc("12:01"),
        nextAt: utc("16:00"),
        alliances: BEFORE,
        before: null,
      }),
    );
    expect(embed).toEqual({
      title: "✓ Last updated at Sat, Nov 7, 10:01 server time",
      url: "https://lap.test/events/9",
      description: "4/4 alliances\nNext update at Sat, Nov 7, 14:00 server time",
    });
  });

  it("after snapshot done: the top three gains in might and kills, signed, with percent", () => {
    const embed = publicSnapshotMessage(summary(), publicCtx());
    expect(embed.title).toBe("✓ Last updated at Sat, Nov 7, 14:01 server time");
    expect(embed.description).toBe(
      [
        "4/4 alliances",
        "**Might ▲**",
        "[OGs] OldGrandmas ▲ +85.8M (+2.0%)",
        "[NSE] Natural Selection ▲ +10.0M (+0.3%)",
        "[WACK] TheWackyOnes ▲ +1.00M (+0.1%)",
        "**Kills ▲**",
        "[NSE] Natural Selection ▲ +1.71M (+2.8%)",
        "[OGs] OldGrandmas ▲ +100K (+0.2%)",
        "[WACK] TheWackyOnes ▲ +500 (+0.0%)",
      ].join("\n"),
    );
  });

  it("partly done: stale alliances are named and left out of the gains", () => {
    const after = AFTER.map((a) => (a.unionId === 1 ? { ...a, isFresh: false } : a));
    const embed = publicSnapshotMessage(
      summary({ status: "partial", stale: [{ unionId: 1, tag: "OGs" }] }),
      publicCtx({ alliances: after }),
    );
    expect(embed.title).toBe("⚠ Last updated at Sat, Nov 7, 14:01 server time");
    expect(embed.description?.split("\n").slice(0, 3)).toEqual([
      "3/4 alliances",
      "○ 1 stale: [OGs] OldGrandmas",
      "**Might ▲**",
    ]);
    expect(embed.description).not.toContain("▲ +85.8M");
  });

  it("sends only the status chip when the run failed", () => {
    const embed = publicSnapshotMessage(
      summary({ status: "failed", error: "quota_low" }),
      publicCtx(),
    );
    expect(embed).toEqual({
      title: "✗ Last update failed at Sat, Nov 7, 14:01 server time",
      url: "https://lap.test/events/9",
    });
  });
});

describe("admin messages", () => {
  it("reports a run in /admin's words and server time, without UTC", () => {
    const text = adminSnapshotMessage(
      summary({
        status: "partial",
        stale: [{ unionId: 3, tag: "URSA" }],
        failed: [{ unionId: 5, tag: "IMPA", error: "upstream_timeout" }],
      }),
      {
        clock,
        phase: "after",
        runUrl: "https://lap.test/admin/runs/41",
        scheduledAt: utc("16:00"),
        startedAt: utc("16:01"),
        finishedAt: utc("16:02"),
        logWriteFailures: 0,
      },
    );
    expect(text).toBe(
      [
        "⚠ After snapshot: partly done · Sat, 11/07/2026, 14:02 server time",
        "due Sat, 11/07/2026, 14:00 server time · started +1 min",
        "21 calls · 779 requests left · 52.0 s",
        "✗ failed [IMPA]: upstream_timeout",
        "○ stale [URSA]",
        "[Run 41 ↗](<https://lap.test/admin/runs/41>)",
      ].join("\n"),
    );
    expect(text).not.toMatch(/UTC/);
  });

  it("names a manual round and leaves out the due line it has no schedule for", () => {
    const text = adminSnapshotMessage(summary({ phase: "before" }), {
      clock,
      phase: "before",
      runUrl: "https://lap.test/admin/runs/41",
      scheduledAt: utc("12:00"),
      startedAt: utc("16:01"),
      finishedAt: utc("16:02"),
      logWriteFailures: 0,
      roundName: "Manual round 2026-11-07",
    });
    expect(text).toBe(
      [
        "✓ Manual round 2026-11-07 · Before snapshot: done · Sat, 11/07/2026, 14:02 server time",
        "21 calls · 779 requests left · 52.0 s",
        "[Run 41 ↗](<https://lap.test/admin/runs/41>)",
      ].join("\n"),
    );
  });

  it("lists the rehearsal verdict lines under ✓ Pass or ✗ Fail and the stamp", () => {
    const text = rehearsalVerdictMessage(
      {
        pass: false,
        lines: [
          { ok: true, text: "both snapshots complete" },
          { ok: false, text: "late start: after +50 min" },
        ],
      },
      clock.stamp(utc("16:46")),
      "https://lap.test/admin/runs",
    );
    expect(text).toBe(
      [
        "✗ Fail · Sat, 11/07/2026, 14:46 server time",
        "✓ both snapshots complete",
        "✗ late start: after +50 min",
        "[Runs ↗](<https://lap.test/admin/runs>)",
      ].join("\n"),
    );
  });

  it("names a skipped rehearsal's reason in /admin's refusal words", () => {
    expect(rehearsalSkippedMessage("event-day", clock.stamp(utc("20:00")))).toBe(
      "skipped · Sat, 11/07/2026, 18:00 server time: Not on the event day or the day after.",
    );
  });

  it("warns in the weekly check when requests left fall under 900", () => {
    const text = quotaReportMessage({
      at: clock.stamp(new Date("2026-11-06T22:01:00Z")),
      remaining: 812,
      warnBelow: 900,
      databaseMb: 123.44,
      warnAboveMb: 700,
      beforeAt: clock.stamp(utc("12:00")),
      afterAt: clock.stamp(utc("16:00")),
    });
    expect(text).toBe(
      [
        "✓ Weekly API quota check · Fri, 11/06/2026, 20:01 server time",
        "⚠ 812 requests left (⚠ under 900)",
        "✓ Database 123.4 MB",
        "Before snapshot Sat, 11/07/2026, 10:00 server time",
        "After snapshot Sat, 11/07/2026, 14:00 server time",
      ].join("\n"),
    );
  });

  it("says the PIN is locked and that the tick still works", () => {
    expect(pinLockedMessage(20)).toBe(
      "🔒 PIN entry is locked for an hour: 20 wrong PINs. The scheduled tick and workflow_dispatch still work.",
    );
  });

  it("names the route, the error class and the digest of an app error", () => {
    expect(appErrorMessage("/api/events/[id]", "route TypeError", "123")).toBe(
      "✗ App error on /api/events/[id]: route TypeError · digest 123 · /admin/errors",
    );
  });
});

describe("manual round public message", () => {
  it("says it is a manual round by name and keeps the rest of the template", () => {
    const plain = publicSnapshotMessage(summary(), publicCtx());
    const embed = publicSnapshotMessage(summary(), publicCtx({ roundName: "Demo round" }));
    expect(embed.description).toBe(
      `Manual round: Demo round. Taken by hand.\n${plain.description}`,
    );
    expect({ ...embed, description: plain.description }).toEqual(plain);
  });

  it("shows typed markdown, mentions and links literally in a round's name and an alliance's", () => {
    const typed = "**Win** @everyone <@123> [click](https://x.test)";
    const literal = "\\*\\*Win\\*\\* @\u200beveryone <@\u200b123\\> \\[click\\](https://x.test)";
    const embed = publicSnapshotMessage(
      summary({ status: "partial" }),
      publicCtx({
        roundName: typed,
        alliances: [alliance(2, "NSE", "Natural Selection", 1, 1, { isFresh: false })],
        before: null,
      }),
    );
    expect(embed.description?.split("\n")).toEqual([
      `Manual round: ${literal}. Taken by hand.`,
      "0/1 alliances",
      "○ 1 stale: [NSE] Natural Selection",
    ]);
    const stale = publicSnapshotMessage(
      summary({ status: "partial" }),
      publicCtx({ alliances: [alliance(5, "A_B", typed, 1, 1, { failed: true })], before: null }),
    );
    expect(stale.description).toContain(`○ 1 stale: [A\\_B] ${literal}`);
  });
});

describe("payloads", () => {
  it("carry no webhook URL, PIN, blocked roster field or name override", async () => {
    const bodies: string[] = [];
    const notifier = createNotifier(TEST_ENV, async (_url, init) => {
      bodies.push(String(init?.body));
      return new Response(null, { status: 204 });
    });
    // A query row carries more fields than the message reads; none of them may leak.
    const leaky = AFTER.map((a) => ({ ...a, x: 101, y: 202, online: true, avatar_url: "p.png" }));
    await notifier.public(publicSnapshotMessage(summary(), publicCtx({ alliances: leaky })));
    await notifier.admin(pinLockedMessage(20), { test: true });

    expect(bodies).toHaveLength(2);
    for (const body of bodies) {
      expect(body).not.toContain(PUBLIC_WEBHOOK);
      expect(body).not.toContain(ADMIN_WEBHOOK);
      expect(body).not.toContain(TEST_PIN);
      const parsed = JSON.parse(body) as Record<string, unknown>;
      expect(parsed).not.toHaveProperty("username");
      expect(findBlockedKeys(parsed)).toEqual([]);
      for (const key of BLOCKED_ROSTER_KEYS) expect(body).not.toContain(`"${key}"`);
    }
    expect(JSON.parse(bodies[1] ?? "{}")).toMatchObject({
      content: expect.stringMatching(/^\[rehearsal\] 🔒/),
    });

    await notifier.admin("x", { manual: true });
    expect(JSON.parse(bodies[2] ?? "{}")).toMatchObject({ content: "[manual] x" });
  });
});
