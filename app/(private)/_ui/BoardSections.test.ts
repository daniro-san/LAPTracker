import { randomUUID } from "node:crypto";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { openTestDb } from "@/lib/db.test-helpers";
import { boardView } from "@/lib/private/board";
import { boardWorkspace } from "@/lib/private/board.test-helpers";
import { createEntry } from "@/lib/private/calendar";
import { newEntry } from "@/lib/private/calendar-model";
import { zonedInstant } from "@/lib/private/calendar-time";
import { WORKSPACE_DICTIONARIES } from "@/lib/private/dictionary";

import { ownClock } from "./BoardParts";
import { calendarWords } from "./calendar-data";

/** The server's clock, UTC−2. */
const SERVER = "Etc/GMT+2";
vi.mock("@/lib/env", () => ({ getEnv: () => ({ SERVER_TZ: SERVER }) }));
const { Week } = await import("./BoardSections");

/** 12:00 UTC on Tuesday, Nov 17: 10:00 on the server's clock (UTC−2). */
const NOW = new Date("2026-11-17T12:00:00Z");
const TODAY = "2026-11-17";
const t = WORKSPACE_DICTIONARIES.en;

/** The week as a member sees it: a member entry today at 23:00 ST and a member one Saturday. */
let html = "";
beforeAll(async () => {
  const db = await openTestDb();
  const { officer, member } = await boardWorkspace(db, NOW);
  const add = (input: Record<string, unknown>) =>
    createEntry(db, officer, newEntry.parse(input), randomUUID());
  await add({ kind: "other", day: TODAY, minute: 1380, title: "Quiz night", forMembers: true });
  await add({ kind: "other", day: "2026-11-21", minute: 600, title: "Rally", forMembers: true });
  const view = await boardView(db, member, TODAY);
  html = renderToStaticMarkup(
    createElement(Week, {
      t,
      language: "en",
      today: TODAY,
      entries: view.entries,
      notices: [],
      now: NOW.getTime(),
    }),
  );
});

describe("the board's week (D116)", () => {
  it("draws a strip of seven days, with a jump only on the days that have events", () => {
    expect(html.match(/<ol[^>]*>.*?<\/ol>/)?.[0].match(/<li>/g)).toHaveLength(7);
    expect(html.match(/href="#day-[^"]+"/g)).toEqual([
      'href="#day-2026-11-17"',
      'href="#day-2026-11-21"',
    ]);
  });

  it("puts each time on the viewer's clock, server time until the browser knows its zone", () => {
    expect(html).toContain("23:00 ST");
    const at = zonedInstant(TODAY, 1380, SERVER);
    expect(ownClock(at, TODAY, "America/Sao_Paulo", calendarWords(t))).toMatchObject({
      time: "22:00",
      label: "your time",
      mark: "",
    });
  });

  it("names the viewer's zone by its offset on the day shown, summer time included (issue 585 batch 4)", () => {
    // Tue, Nov 17 23:00 ST (01:00 UTC on the 18th) is 03:00 in Kyiv (UTC+2) the next day; Wed, Jul 15
    // 23:00 ST is 04:00 there (UTC+3, summer time).
    const words = calendarWords(t);
    const winter = ownClock(zonedInstant(TODAY, 1380, SERVER), TODAY, "Europe/Kyiv", words);
    const summer = ownClock(
      zonedInstant("2026-07-15", 1380, SERVER),
      "2026-07-15",
      "Europe/Kyiv",
      words,
    );
    expect(winter).toMatchObject({ time: "03:00", zone: "(UTC+2)", mark: "the next day" });
    expect(summer).toMatchObject({ time: "04:00", zone: "(UTC+3)" });
    expect(
      ownClock(zonedInstant(TODAY, 1380, SERVER), TODAY, "America/Sao_Paulo", words).zone,
    ).toBe("(UTC−3)");
    // Portuguese says "seu horário", not "sua hora".
    const pt = calendarWords(WORKSPACE_DICTIONARIES["pt-BR"]);
    expect(ownClock(zonedInstant(TODAY, 1380, SERVER), TODAY, "America/Sao_Paulo", pt).label).toBe(
      "seu horário",
    );
  });
});
