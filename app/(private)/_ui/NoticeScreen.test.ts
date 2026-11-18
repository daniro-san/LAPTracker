import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { WORKSPACE_DICTIONARIES } from "@/lib/private/dictionary";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {}, push: () => {} }) }));

const { Copies } = await import("./NoticeScreen");

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
