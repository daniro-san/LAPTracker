import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { WORKSPACE_DICTIONARIES } from "@/lib/private/dictionary";
import { NOTICE_FIELDS } from "@/lib/private/notice-rules";

import type { ScreenProps } from "./NoticeScreen";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {}, push: () => {} }) }));

const { Copies, NoticeScreen } = await import("./NoticeScreen");

describe("a notice's three copies (D116)", () => {
  it("says under each button what it copies, in the officer's language, tied to the button", () => {
    const render = (viewer: "en" | "fr") =>
      renderToStaticMarkup(
        createElement(Copies, {
          t: WORKSPACE_DICTIONARIES[viewer],
          viewer,
          language: "en",
          title: "Caravans",
          text: "Leave at 16:00.",
        }),
      );

    const en = render("en");
    expect(en).toContain("Cut to 1,000 characters, the game’s limit.");
    expect(en).toContain("The whole text, never cut.");
    expect(en).toContain("Title in bold, formatted for Discord. Pings no one.");
    for (const id of ["copy-en-notice", "copy-en-mail", "copy-en-discord"]) {
      expect(en).toContain(`aria-describedby="${id}"`);
      expect(en).toContain(`id="${id}"`);
    }
    expect(render("fr")).toContain("Coupé à 1 000 caractères, la limite du jeu.");
  });
});

describe("a notice's language tabs (issue 412)", () => {
  it("shows one language at a time, the reader's first, each tab with its state and labelling its panel", () => {
    const fields = Object.fromEntries(
      NOTICE_FIELDS.map((f) => [f, { value: "", version: 0 }]),
    ) as ScreenProps["fields"];
    const html = renderToStaticMarkup(
      createElement(NoticeScreen, {
        slug: "ogs",
        id: 7,
        fields: {
          ...fields,
          title: { value: "Caravans", version: 1 },
          en: { value: "Leave at 16:00.", version: 2 },
          "pt-BR": { value: "Saída às 16:00.", version: 3 },
        },
        stale: [],
        translated: ["pt-BR"],
        reviewed: ["en"],
        t: WORKSPACE_DICTIONARIES["pt-BR"],
        viewer: "pt-BR",
        ai: false,
        languages: ["pt-BR", "en", "fr"],
        source: "pt-BR",
        meta: { written: "", changed: "", flags: [] },
        publish: { audience: "leaders", channel: null, last: null },
        calendar: { linked: [], choices: [] },
        reviews: { open: [], done: [], officers: [] },
      }),
    );
    const tabs = [...html.matchAll(/<button[^>]*role="tab"[^>]*>/g)].map((m) => m[0]);
    expect(tabs.map((tab) => /id="read-tab-([^"]+)"/.exec(tab)?.[1])).toEqual([
      "pt-BR",
      "en",
      "fr",
    ]);
    expect(tabs.map((tab) => tab.includes('aria-selected="true"'))).toEqual([true, false, false]);
    expect(html).toContain('role="tabpanel" aria-labelledby="read-tab-pt-BR"');
    expect(html.match(/role="tabpanel"/g)).toHaveLength(1);
    expect(html).toContain("Saída às 16:00.");
    expect(html).not.toContain("Leave at 16:00.");
    for (const word of ["Traduzido (IA)", "Revisado", "Faltando"]) expect(html).toContain(word);
  });
});
