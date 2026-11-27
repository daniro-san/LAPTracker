// The members' board's thank-you card (issue 404, D114): a member sees the officer's thank-you in their
// language with the week and the officer's name, and nothing else about anyone; after a Take down the board
// renders as if no thanks had been shared, for a member and in an officer's preview alike. Invented names.
import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { Db } from "@/lib/db";
import { openTestDb, truncateAll } from "@/lib/db.test-helpers";
import { requireBoard, requireWorkspace, type WorkspaceAccess } from "@/lib/private/access";
import { boardView } from "@/lib/private/board";
import { WORKSPACE_DICTIONARIES, type WorkspaceLanguage } from "@/lib/private/dictionary";
import { createSession } from "@/lib/private/session";
import { shareThanks, takeDownThanks } from "@/lib/private/thanks";
import { dailyRosters, workspaces, workspaceUsers } from "@/lib/schema";

import { BoardThanks } from "./BoardThanks";

// Take down refreshes the page through the router, which a static render has not mounted.
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined }) }));

const NOW = new Date("2026-11-22T12:00:00Z");
const TODAY = "2026-11-22";

let db: Db;
let ws: number;
/** Each person's account, made once: an officer opens the desk and the board preview as one person. */
const users = new Map<string, number>();
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  users.clear();
  const [made] = await db
    .insert(workspaces)
    .values({
      unionId: 67111155,
      slug: "ogs",
      discordGuildId: "1",
      leaderRoleIds: ["2"],
      memberRoleIds: ["3"],
    })
    .returning({ id: workspaces.id });
  ws = made?.id ?? 0;
});

async function jar(name: string, tier: "officer" | "member") {
  if (!users.has(name)) {
    const [user] = await db
      .insert(workspaceUsers)
      .values({ workspaceId: ws, discordUserId: `id-${name}`, displayName: name })
      .returning({ id: workspaceUsers.id });
    users.set(name, user?.id ?? 0);
  }
  const { token } = await createSession(db, ws, users.get(name) ?? 0, NOW, null, tier);
  return { get: () => ({ value: token }) };
}

/** The board as `who` sees it, and the card's HTML in `language`. */
async function seen(who: Awaited<ReturnType<typeof jar>>, language: WorkspaceLanguage) {
  const access = await requireBoard(db, "ogs", who, NOW);
  if (!access.ok) throw new Error("no board");
  const view = await boardView(db, access, TODAY);
  const html = renderToStaticMarkup(
    createElement(BoardThanks, {
      thanks: view.thanks,
      thanked: view.thanked,
      t: WORKSPACE_DICTIONARIES[language],
      language,
      slug: "ogs",
      officer: access.officer,
    }),
  );
  return { view, html };
}

const board = (by: WorkspaceAccess, en: string, week = "2026-11-16") =>
  shareThanks(
    db,
    by,
    {
      action: "share",
      target: "board",
      week,
      title: "Weekly appreciation",
      texts: { en, "pt-BR": "Obrigado, Bramble, de coração." },
      names: ["Bramble"],
      requestId: randomUUID(),
    },
    {
      fetch: () => Promise.reject(new Error("no Discord here")),
      now: NOW,
      channels: { members: null, leaders: null },
      names: { en: "English", "pt-BR": "Português", fr: "Français" },
    },
  );

describe("the thank-you card on the members' board (D114)", () => {
  it("shows members the newest thank-you in their language; Take down leaves no trace", async () => {
    const officer = await requireWorkspace(db, "ogs", await jar("Rook (R4)", "officer"), NOW);
    if (!officer.ok) throw new Error("no access");
    await board(officer, "An older thank-you.", "2026-11-09");
    const shared = await board(officer, "Thank you, Bramble, from all of us.");
    const member = await jar("Fern", "member");
    const preview = await jar("Rook (R4)", "officer");

    const pt = await seen(member, "pt-BR");
    expect(pt.view.thanks).toEqual({
      id: shared.ok ? shared.row.id : 0,
      week: "2026-11-16",
      texts: {
        en: "Thank you, Bramble, from all of us.",
        "pt-BR": "Obrigado, Bramble, de coração.",
      },
      names: ["Bramble"],
      by: "Rook (R4)",
    });
    // The name in bold, and the signature without the rank tag.
    expect(pt.html).toContain(
      'Obrigado, <strong class="font-subhead font-bold"><bdi>Bramble</bdi></strong>, de coração.',
    );
    expect(pt.html).toContain('Com carinho, <bdi translate="no">Rook</bdi>');
    expect(pt.html).not.toContain("Tirar do mural");
    expect((await seen(preview, "en")).html).toContain("Take down");

    expect(await takeDownThanks(db, officer, shared.ok ? shared.row.id : 0, NOW)).toBe(true);
    // The card is gone for both, and the older one does not come back: no frame, no gap, no message.
    for (const who of [member, preview]) {
      const after = await seen(who, "en");
      expect(after.view.thanks).toBeNull();
      expect(after.html).toBe("");
    }
  });

  it("opens with the member's own line when their approved link is named, and with nothing personal otherwise", async () => {
    const officer = await requireWorkspace(db, "ogs", await jar("Rook (R4)", "officer"), NOW);
    if (!officer.ok) throw new Error("no access");
    await board(officer, "Thank you, Bramble, from all of us.");
    await db.insert(dailyRosters).values({
      readDay: "2026-11-21",
      unionId: 67111155,
      memberCount: 2,
      isFresh: true,
      memberUids: [501, 502],
      memberNames: ["Bramble", "Fern"],
      memberPower: [1, 1],
      memberKills: [0, 0],
    });
    const link = async (name: string, uid: number, state: "approved" | "pending") => {
      const who = await jar(name, "member");
      await db
        .update(workspaceUsers)
        .set({ playerUid: uid, playerLink: state })
        .where(eq(workspaceUsers.id, users.get(name) ?? 0));
      return who;
    };

    const named = await seen(await link("bramble-discord", 501, "approved"), "en");
    expect(named.view.thanked).toBe("Bramble");
    // The line before the letter, and the name marked in it.
    expect(named.html.indexOf("you’re in this thank-you")).toBeLessThan(
      named.html.indexOf("from all of us"),
    );
    expect(named.html).toContain('<bdi translate="no">Bramble</bdi>, you’re in this thank-you.');
    expect(named.html).toContain("<mark");
    // A pending claim on the same player, a member the card does not name, and no link: nothing personal.
    for (const who of [
      await link("claimant", 501, "pending"),
      await link("fern-discord", 502, "approved"),
      await jar("Moss", "member"),
    ]) {
      const other = await seen(who, "en");
      expect(other.view.thanked).toBeNull();
      expect(other.html).not.toContain("you’re in this thank-you");
      expect(other.html).not.toContain("<mark");
    }
  });

  it("shows the alliance's emblem through /img/badge/[id] (D22), and none when it has none", () => {
    const thanks = {
      id: 1,
      week: "2026-11-16",
      texts: { en: "Thank you all." },
      names: [],
      by: "Rook",
    };
    const card = (badgeId: number | null) =>
      renderToStaticMarkup(
        createElement(BoardThanks, {
          thanks,
          thanked: null,
          t: WORKSPACE_DICTIONARIES.en,
          language: "en",
          slug: "ogs",
          alliance: { tag: "OGS", name: "Old Gnomes", badgeId },
          officer: false,
        }),
      );
    expect(card(103)).toContain('src="/img/badge/103"');
    expect(card(null)).not.toContain("/img/badge/");
  });
});
