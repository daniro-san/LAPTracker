// A "This is me" claim on Home's "To review" an officer can check (issue 585, F15): the player links to
// their member card, the day it was asked is shown, and the refusal reads "Not them". Invented names.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { Db } from "@/lib/db";
import { openTestDb, truncateAll } from "@/lib/db.test-helpers";
import { requireWorkspace } from "@/lib/private/access";
import { WORKSPACE_DICTIONARIES } from "@/lib/private/dictionary";
import { linkWords } from "@/lib/private/dictionary.me";
import { cardLink, linkReviews } from "@/lib/private/me-link";
import { cardFormats } from "@/lib/private/member-card";
import { createSession } from "@/lib/private/session";
import { dailyReads, dailyRosters, workspaces, workspaceUsers } from "@/lib/schema";

import { CardLink } from "./MemberLinks";
import { ReviewJump, ToReview } from "./ToReview";

// An answer refreshes the page through the router, which a static render has not mounted.
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined }) }));

const OGS = 67111155;
const NOW = new Date("2026-11-21T14:00:00Z"); // Sat 12:00 ST
const ASKED = new Date("2026-11-20T01:00:00Z"); // Thu 23:00 ST, already Fri in UTC
const t = WORKSPACE_DICTIONARIES.en;

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
});

/** The alliance's roster, an officer's access and Wren's pending claim of player 2. */
async function claimed() {
  await db.insert(dailyReads).values({ day: "2026-11-20", startedAt: NOW, status: "complete" });
  await db.insert(dailyRosters).values({
    readDay: "2026-11-20",
    unionId: OGS,
    memberCount: 2,
    isFresh: true,
    memberUids: [1, 2],
    memberNames: ["Quillon", "Wren Invented"],
    memberPower: [2000, 1000],
    memberKills: [0, 0],
    rawJson: {
      members: [
        { uid: 1, nick_name: "Quillon", rank_code: 104 },
        { uid: 2, nick_name: "Wren Invented", rank_code: 103 },
      ],
    },
  });
  const [made] = await db
    .insert(workspaces)
    .values({ unionId: OGS, slug: "ogs", discordGuildId: "1", leaderRoleIds: ["2"] })
    .returning({ id: workspaces.id });
  const ws = made?.id ?? 0;
  const [officer] = await db
    .insert(workspaceUsers)
    .values({ workspaceId: ws, discordUserId: "id-officer", displayName: "Officer" })
    .returning({ id: workspaceUsers.id });
  // Wren's claim of player 2, as "This is me" writes it: pending, with the time asked.
  await db.insert(workspaceUsers).values({
    workspaceId: ws,
    discordUserId: "id-wren",
    displayName: "wren_on_discord",
    playerUid: 2,
    playerLink: "pending",
    playerLinkedAt: ASKED,
  });
  const { token } = await createSession(db, ws, officer?.id ?? 0, NOW, null, "officer");
  const access = await requireWorkspace(db, "ogs", { get: () => ({ value: token }) }, NOW);
  if (!access.ok) throw new Error("no access");
  return access;
}

async function home(access: Awaited<ReturnType<typeof claimed>>) {
  return renderToStaticMarkup(
    createElement(ToReview, {
      slug: "ogs",
      items: [],
      t,
      language: "en",
      toMatch: null,
      reviews: [],
      when: () => "",
      day: cardFormats("en", "Etc/GMT+2", NOW).date,
      links: await linkReviews(db, access),
    }),
  );
}

describe("a claim an officer can check on Home (issue 585)", () => {
  it("links the claimed player to their member card", async () => {
    expect(await home(await claimed())).toMatch(
      /href="\/w\/ogs\/members\?m=2"[^>]*><bdi translate="no">Wren Invented · R3<\/bdi><\/a>/,
    );
  });

  it("says the day the member asked, in server time", async () => {
    expect(await home(await claimed())).toContain("Asked on Thu, Nov 19 to see their own page.");
  });

  it("says on Home's first screen that the claim waits in To review, and nothing once none waits (slice 4)", async () => {
    const waiting = (await linkReviews(db, await claimed())).length;
    const jump = (n: number) => renderToStaticMarkup(createElement(ReviewJump, { t, waiting: n }));
    expect(jump(waiting)).toMatch(/href="#to-review"[^>]*>1 waiting in “To review” ↓<\/a>/);
    expect(jump(0)).toBe("");
  });

  it("offers Not them instead of Reject, on Home and on the card", async () => {
    const access = await claimed();
    const link = await cardLink(db, access, 2, t);
    if (!link) throw new Error("no link");
    const card = renderToStaticMarkup(
      createElement(CardLink, { slug: "ogs", link, words: linkWords(t) }),
    );
    for (const html of [await home(access), card]) {
      expect(html).toContain(">Not them</button>");
      expect(html).not.toContain("Reject");
    }
  });
});
