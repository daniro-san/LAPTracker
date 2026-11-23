// Alliance settings → Posts (#713 part C, D159): each catalog post shows what it holds, a visibly labelled
// switch, channel, title and language, its fixed day, and the next post in plain words: when and where while
// on, "Off" while off, and why nothing is posted while its channel has no webhook. A title over 80
// characters is marked and says so. Invented names only.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { WORKSPACE_DICTIONARIES } from "@/lib/private/dictionary";
import type { PostView } from "@/lib/private/post-settings";

import { PostCatalog } from "./PostCatalog";

// Save refreshes the page through the router, which a static render has not mounted.
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined }) }));

const t = WORKSPACE_DICTIONARIES.en;
const week: PostView = {
  post: "week",
  on: true,
  channel: "members",
  title: "",
  language: "en",
  channels: [
    { channel: "members", name: "general" },
    { channel: "leaders", name: null },
  ],
  day: "Monday",
  from: "00:00",
  to: "01:15",
};
const render = (row: Partial<PostView>) =>
  renderToStaticMarkup(
    createElement(PostCatalog, { slug: "nse", rows: [{ ...week, ...row }], t, language: "en" }),
  );
/** The text of the preview figure. */
const preview = (html: string) =>
  /<figure[^>]*><figcaption[^>]*>Next post<\/figcaption><p[^>]*>([^<]*)<\/p>/.exec(html)?.[1];

describe("the Posts card in Alliance settings (D159)", () => {
  it("labels every control and says when and where the next post goes", () => {
    const html = render({});
    expect(html).toContain(">This week in the alliance</h3>");
    expect(html).toContain("marked “Members can see this”");
    expect(html).toMatch(/<label[^>]*><input type="checkbox"[^>]*checked=""[^>]*\/>.*Post it/s);
    expect(html).toMatch(/<span class="font-medium">Channel<\/span><select/);
    expect(html).toContain(
      '<option value="members" selected="">Members’ channel (#general)</option>',
    );
    expect(html).toContain('<option value="leaders">Leaders’ channel (not set up)</option>');
    expect(html).toContain("Every Monday: the calendar week starts then.");
    expect(html).toMatch(/<label for="post-week-title"[^>]*>Title<\/label>/);
    expect(html).toContain("Leave it empty for “This week in the alliance”.");
    expect(html).toMatch(/<span class="font-medium">Language of the post<\/span><select/);
    expect(preview(html)).toBe("Every Monday, between 00:00 and 01:15 ST, in #general.");
  });

  it("says nothing is posted while it is off, or while its channel has no webhook", () => {
    expect(preview(render({ on: false }))).toBe("Off: nothing is posted.");
    expect(preview(render({ channel: "leaders" }))).toBe(
      "Nothing is posted until the leaders’ channel is set up: paste its webhook under Discord, above.",
    );
  });

  it("counts the title as the server does and marks one over 80 characters", () => {
    expect(render({ title: `  ${"x".repeat(80)}\u200B ` })).toContain("80 of 80 characters");
    const html = render({ title: "x".repeat(81) });
    expect(html).toMatch(/<input id="post-week-title"[^>]*aria-invalid="true"/);
    expect(html).toContain("Too long: keep it to 80 characters.");
  });
});
