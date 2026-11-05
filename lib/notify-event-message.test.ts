import { describe, expect, it, vi } from "vitest";

import { ADMIN_WEBHOOK, PUBLIC_WEBHOOK, TEST_ENV } from "./app-context.test-helpers";
import type { RunSummary } from "./collector";
import {
  adminEventMessage,
  adminSnapshotMessage,
  createNotifier,
  discordClock,
  publicSnapshotMessage,
  type PublicContext,
} from "./notify";

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
const publicCtx = (over: Partial<PublicContext> = {}): PublicContext => ({
  clock,
  eventUrl: "https://lap.test/events/9",
  finishedAt: utc("16:01"),
  nextAt: null,
  alliances: [],
  before: null,
  ...over,
});

describe("one message per channel per event (D31)", () => {
  const calls: { method: string; url: string }[] = [];
  const fakeDiscord =
    (reply: (method: string) => Response): typeof fetch =>
    async (input, init) => {
      calls.push({ method: String(init?.method), url: String(input) });
      return reply(String(init?.method));
    };

  it("posts with wait=true and returns the created message's id", async () => {
    calls.length = 0;
    const notifier = createNotifier(
      TEST_ENV,
      fakeDiscord(() => Response.json({ id: "555" })),
    );
    expect(await notifier.admin("hello")).toBe("555");
    expect(calls).toEqual([{ method: "POST", url: `${ADMIN_WEBHOOK}?wait=true` }]);
  });

  it("edits the stored message instead of posting when the next phase finishes", async () => {
    calls.length = 0;
    const notifier = createNotifier(
      TEST_ENV,
      fakeDiscord(() => Response.json({ id: "555" })),
    );
    expect(await notifier.public(publicSnapshotMessage(summary(), publicCtx()), "555")).toBe("555");
    expect(calls).toEqual([{ method: "PATCH", url: `${PUBLIC_WEBHOOK}/messages/555` }]);
  });

  it("posts a new message and returns its id when the stored one was deleted", async () => {
    calls.length = 0;
    const notifier = createNotifier(
      TEST_ENV,
      fakeDiscord((m) =>
        m === "PATCH" ? new Response(null, { status: 404 }) : Response.json({ id: "777" }),
      ),
    );
    expect(await notifier.admin("hello", { messageId: "555" })).toBe("777");
    expect(calls.map((c) => c.method)).toEqual(["PATCH", "POST"]);
  });

  it("keeps the stored id and does not post a second message when an edit fails otherwise", async () => {
    calls.length = 0;
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const notifier = createNotifier(
      TEST_ENV,
      fakeDiscord(() => new Response(null, { status: 500 })),
    );
    expect(await notifier.admin("hello", { messageId: "555" })).toBe("555");
    expect(calls.map((c) => c.method)).toEqual(["PATCH"]);
    error.mockRestore();
  });

  it("returns no id and logs without the URL when Discord does not return one", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const notifier = createNotifier(
      TEST_ENV,
      fakeDiscord(() => new Response(null, { status: 204 })),
    );
    expect(await notifier.admin("hello")).toBeNull();
    expect(error).toHaveBeenCalledWith("notify.no_message_id");
    expect(JSON.stringify(error.mock.calls)).not.toContain(ADMIN_WEBHOOK);
    error.mockRestore();
  });

  it("shows the whole Saturday event in the admin message: name, then a block per phase", () => {
    const block = (phase: "before" | "after", at: string) =>
      adminSnapshotMessage(summary({ phase }), {
        clock,
        phase,
        runUrl: "https://lap.test/admin/runs/41",
        scheduledAt: utc("12:00"),
        startedAt: utc("12:00"),
        finishedAt: utc(at),
        logWriteFailures: 0,
      });
    const text = adminEventMessage("Saturday 2026-11-07", [
      block("before", "12:01"),
      block("after", "16:01"),
    ]);
    expect(text.split("\n\n")).toEqual([
      "**Saturday 2026-11-07**",
      expect.stringMatching(/^✓ Before snapshot: done/),
      expect.stringMatching(/^✓ After snapshot: done/),
    ]);
  });

  it("adds the Before's time to the public After message and the round's name for a manual round", () => {
    const embed = publicSnapshotMessage(
      summary(),
      publicCtx({
        beforeAt: utc("12:01"),
        roundName: "Demo round",
        alliances: [
          {
            unionId: 1,
            tag: "OGs",
            name: "OldGrandmas",
            isFresh: true,
            failed: false,
            totalPower: 1,
            totalKills: 1,
          },
        ],
      }),
    );
    expect(embed.description?.split("\n").slice(0, 3)).toEqual([
      "Manual round: Demo round. Taken by hand.",
      "Before snapshot done at Sat, Nov 7, 10:01 server",
      "1/1 alliances",
    ]);
  });
});
