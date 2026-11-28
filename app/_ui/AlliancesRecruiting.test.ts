import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { en } from "@/lib/copy";
import type { RecruitingRow } from "@/lib/queries";

import type { Clock } from "./format";

const flag = vi.hoisted(() => ({ on: true }));
vi.mock("@/lib/flags", () => ({ isOn: async () => flag.on }));
const row: RecruitingRow = {
  unionId: 7,
  tag: "OWL",
  name: "Night Owls",
  badgeId: null,
  day: "2026-11-26",
  open: false,
  minMight: 8_000_000,
  minHq: 14,
  members: 73,
  capacity: 100,
  spotsFree: 27,
};
vi.mock("./public-reads", () => ({ sharedRecruiting: async () => [row] }));

const { AlliancesRecruiting } = await import("./AlliancesRecruiting");

const clock = { day: () => "Nov 26" } as unknown as Clock;
const render = async () =>
  renderToStaticMarkup(
    await AlliancesRecruiting({
      today: "2026-11-27",
      href: (id) => `/alliances/${id}/history`,
      clock,
      locale: "en",
      copy: en,
    }),
  );

describe("AlliancesRecruiting", () => {
  it("lists each alliance as a link to its page, with spots free, rules and the read's date", async () => {
    flag.on = true;
    const html = await render();
    expect(html).toContain("Alliances recruiting");
    expect(html).toContain('href="/alliances/7/history"');
    expect(html).toContain("[OWL] Night Owls");
    expect(html).toContain("27 spots free (73/100)");
    expect(html).toContain("By application");
    expect(html).toContain("Minimum might 8M");
    expect(html).toContain("Minimum HQ 14");
    expect(html).toContain("As of Nov 26");
  });

  it("is not drawn while the flag is off", async () => {
    flag.on = false;
    expect(await render()).toBe("");
  });
});
