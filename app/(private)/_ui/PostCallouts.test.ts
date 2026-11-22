// Alliance settings → Your line on our posts (#713, D155): each post's field has a visible label tied to it,
// says where the line goes and how long it is, and previews the next post's first lines; a line over 120
// characters is marked and says so. Invented text only.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { WORKSPACE_DICTIONARIES } from "@/lib/private/dictionary";

import { PostCallouts } from "./PostCallouts";

// Save refreshes the page through the router, which a static render has not mounted.
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined }) }));

const t = WORKSPACE_DICTIONARIES.en;
const render = (callout: string) =>
  renderToStaticMarkup(
    createElement(PostCallouts, {
      slug: "nse",
      rows: [
        { post: "shield", callout, title: "Raid Shield check" },
        { post: "thanks", callout: "", title: "Weekly appreciation" },
      ],
      t,
      language: "en",
    }),
  );

describe("the lines on our posts in Alliance settings (D155)", () => {
  it("labels each field visibly, says where it goes and how long it is, and previews the post", () => {
    const html = render("Shields up, family");
    expect(html).toContain(
      '<label for="callout-shield" class="font-medium">Raid Shield summary</label>',
    );
    expect(html).toMatch(/<input id="callout-shield"[^>]*value="Shields up, family"/);
    expect(html).toContain("Goes above the summary in the Raid Shield channel.");
    expect(html).toContain("18 of 120 characters");
    // The preview: the line as typed, then our title; a post with no line starts with its title.
    expect(html).toMatch(/Preview of the next post.*Shields up, family.*Raid Shield check/s);
    expect(html).toMatch(/No line yet: the post starts with its title\..*Weekly appreciation/s);
    expect(html).not.toContain("aria-invalid");
  });

  it("marks a line over 120 characters and says so", () => {
    const html = render("x".repeat(121));
    expect(html).toMatch(/<input id="callout-shield"[^>]*aria-invalid="true"/);
    expect(html).toContain("Too long: keep it to 120 characters.");
    expect(render("x".repeat(120))).toContain("120 of 120 characters");
  });
});
