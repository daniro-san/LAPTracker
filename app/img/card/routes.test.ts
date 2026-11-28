// The link preview cards (issue 830, D164): an event read by the tick on PGlite, then each /img/card route
// drawn from the pages' shared reads (the in-memory cache of lib/app-context.test-helpers.ts).
import { beforeAll, describe, expect, it, vi } from "vitest";

import { cardPreview } from "@/app/_ui/preview";
import type { AppContext } from "@/lib/app-context";
import { request, testContext } from "@/lib/app-context.test-helpers";
import { ago, fakeV1, IDS, minutes, roster } from "@/lib/collector.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb } from "@/lib/db.test-helpers";
import type { LinkCard } from "@/lib/link-card";
import { findBlockedKeys } from "@/lib/queries/blocked-keys";
import { events } from "@/lib/schema";
import { allianceBoard } from "@/lib/schema-alliances";
import { runTick } from "@/lib/tick";

const holder = vi.hoisted(() => ({ ctx: null as AppContext | null, cards: [] as LinkCard[] }));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));
// The Discord message's picture (D58) and the page connection's `after` are not what these tests are about.
vi.mock("@/lib/event-image", () => ({ eventImage: async () => new Uint8Array([1]) }));
vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  after: () => undefined,
}));
vi.mock("@/lib/flags", async (original) => ({
  ...(await original<typeof import("@/lib/flags")>()),
  isOn: async () => true,
}));
// Each card's source data, as handed to the renderer.
vi.mock("@/lib/link-card", async (original) => {
  const real = await original<typeof import("@/lib/link-card")>();
  return {
    ...real,
    linkCardResponse: (card: LinkCard) => {
      holder.cards.push(card);
      return real.linkCardResponse(card);
    },
  };
});

const routes = {
  event: (await import("./event/[id]/route")).GET,
  alliance: (await import("./event/[id]/alliance/[unionId]/route")).GET,
  player: (await import("./player/[uid]/route")).GET,
  board: (await import("./alliance/[unionId]/route")).GET,
};
vi.setConfig({ testTimeout: 30_000 });

const ONLINE_AT = 1_764_000_000;
const UNION = IDS[0] as number;
let eventId = 0;

beforeAll(async () => {
  const db: Db = await openTestDb();
  const t = testContext(db);
  holder.ctx = t.ctx;
  // The Start at 12:00 UTC with 6M might, the End at 16:00 UTC with 9M; the members' raw rows carry the
  // keys no card may show.
  const raw = (id: number) => ({
    union_id: id,
    members: [{ uid: id * 10 + 1, online: 1, last_online_at: ONLINE_AT, x: 1, y: 2 }],
  });
  for (const [at, extra] of [
    [new Date("2026-11-07T12:00:20Z"), {}],
    [new Date("2026-11-07T16:00:20Z"), { totalPower: 9_000_000 }],
  ] as const) {
    t.clock.now = at;
    t.ctx.v1 = fakeV1((id) => roster(id, ago(at, minutes(1)), { ...extra, raw: raw(id) }));
    await runTick(t.ctx, db, "https://laptracker.test");
  }
  const [event] = await db.select({ id: events.id }).from(events);
  eventId = (event as { id: number }).id;
  await db.insert(allianceBoard).values({
    day: "2026-11-07",
    unionId: UNION,
    tag: "T1",
    name: "Alliance board name",
    power: 9_000_000,
    powerRank: 4,
    kills: 500,
    killsRank: 7,
    pulledAt: new Date("2026-11-07T08:00:00Z"),
  });
});

/** The route's response, checked to be a 1200 × 630 PNG, and the card it drew. */
async function drawn(response: Promise<Response>) {
  const res = await response;
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toBe("image/png");
  expect(res.headers.get("cache-control")).toBe(
    "public, max-age=300, s-maxage=300, stale-while-revalidate=3600",
  );
  const png = new DataView(await res.arrayBuffer());
  // IHDR: width and height are the big-endian words at bytes 16 and 20.
  expect([png.getUint32(16), png.getUint32(20)]).toEqual([1200, 630]);
  return holder.cards.at(-1) as LinkCard;
}

const req = (path: string) => request(path, { method: "GET" });
const with_ = <T>(params: T) => ({ params: Promise.resolve(params) });

describe("GET /img/card/*", () => {
  it("draws each page's card as a 1200 × 630 PNG with the facts that page shows", async () => {
    const id = String(eventId);
    const unionId = String(UNION);
    const event = await drawn(routes.event(req(`/img/card/event/${id}`), with_({ id })));
    expect(event.title).toBe("Sat, Nov 7");
    expect(event.rows).toHaveLength(5);
    expect(event.rows?.[0]).toMatchObject({ rank: "#1", value: "9.00M", note: { text: "+3.00M" } });

    const alliance = await drawn(
      routes.alliance(req(`/img/card/event/${id}/alliance/${unionId}`), with_({ id, unionId })),
    );
    expect(alliance.title).toBe(`[T1] Alliance ${UNION}`);
    expect(alliance.figures.map((f) => [f.label, f.value, f.note?.text])).toEqual([
      ["Might", "9.00M", "+3.00M"],
      ["Kills", "300", "0"],
      ["Members", "3", "0"],
      ["Rank", expect.stringMatching(/^#\d+$/), undefined],
    ]);

    const uid = String(UNION * 10 + 3);
    const player = await drawn(routes.player(req(`/img/card/player/${uid}`), with_({ uid })));
    expect(player).toMatchObject({ title: "m3", subtitle: `[T1] Alliance ${UNION}` });
    expect(player.figures.map((f) => f.value)).toEqual(["3.00M", "—", "33"]);

    const board = await drawn(
      routes.board(req(`/img/card/alliance/${unionId}`), with_({ unionId })),
    );
    expect(board.figures.map((f) => [f.label, f.value, f.note?.text])).toEqual([
      ["Might", "9.00M", "#4"],
      ["Kills", "500", "#7"],
    ]);
  });

  it("never puts a blocked roster key or its value in a card", () => {
    expect(holder.cards).toHaveLength(4);
    expect(findBlockedKeys(holder.cards)).toEqual([]);
    expect(JSON.stringify(holder.cards)).not.toContain(String(ONLINE_AT));
  });
});

describe("cardPreview", () => {
  it("sets og:image to the card with its size, and the large-picture Twitter card", () => {
    const meta = cardPreview("/img/card/player/1", "m3 · Event Ledger", "Might 3M");
    expect(meta.openGraph).toMatchObject({
      title: "m3 · Event Ledger",
      description: "Might 3M",
      images: [{ url: "/img/card/player/1", width: 1200, height: 630 }],
    });
    expect(meta.twitter).toMatchObject({ card: "summary_large_image" });
  });
});
