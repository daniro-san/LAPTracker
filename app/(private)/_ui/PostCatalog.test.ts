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
  defaultTitles: {
    en: "This week in the alliance",
    "pt-BR": "Esta semana na aliança",
    fr: "Cette semaine dans l’alliance",
  },
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
    // The title help names our title in the language the post is written in, not the officer's.
    expect(render({ language: "fr" })).toContain(
      "Leave it empty for “Cette semaine dans l’alliance”.",
    );
  });

  it("says right under the switch that nothing is posted while off, or while its channel has no webhook", () => {
    expect(preview(render({ on: false }))).toBe("Off: nothing is posted.");
    const html = render({ channel: "leaders" });
    expect(preview(html)).toBe(
      "Nothing is posted until the leaders’ channel is set up: paste its webhook under Discord, above.",
    );
    // On with no webhook is a warning in yarn, and it sits between the switch and the channel.
    expect(html).toMatch(
      /Post it.*<figure.*<p class="font-semibold text-yarn">Nothing is posted.*Channel/s,
    );
  });

  it("shows the shield-up reminder with its Friday evening time and only the members' channel", () => {
    const shieldUp: PostView = {
      ...week,
      post: "shield_up",
      defaultTitles: {
        en: "Shield up before the reset",
        "pt-BR": "Escudo ligado antes do reset",
        fr: "Bouclier actif avant le reset",
      },
      channels: [{ channel: "members", name: "general" }],
      day: "Friday",
      from: "20:30",
      to: "20:45",
    };
    const html = renderToStaticMarkup(
      createElement(PostCatalog, { slug: "nse", rows: [week, shieldUp], t, language: "en" }),
    );
    const group = html.slice(html.indexOf('aria-labelledby="post-shield_up-name"'));
    expect(group).toContain(">Shield-up reminder</h3>");
    expect(group).toContain("No player names or counts.");
    expect(group).toContain("Every Friday evening, before the raid at the reset (00:00 ST).");
    expect(group).toContain("Leave it empty for “Shield up before the reset”.");
    expect(preview(group)).toBe("Every Friday, between 20:30 and 20:45 ST, in #general.");
    expect(group).not.toContain('<option value="leaders"');
  });

  it("shows the welcome as a daily post: every day after the daily update, until 00:00 ST", () => {
    const welcome: PostView = {
      ...week,
      post: "welcome",
      defaultTitles: {
        en: "Welcome to our new members",
        "pt-BR": "Boas-vindas aos novos membros",
        fr: "Bienvenue aux nouveaux membres",
      },
      channels: [{ channel: "members", name: "general" }],
      day: null,
      from: "23:30",
      to: "00:00",
    };
    const html = renderToStaticMarkup(
      createElement(PostCatalog, { slug: "nse", rows: [welcome], t, language: "en" }),
    );
    expect(html).toContain(">Welcome new members</h3>");
    expect(html).toContain("Never anyone who left.");
    expect(html).toContain("Every day, after the daily update.");
    expect(preview(html)).toBe("Every day, between 23:30 and 00:00 ST, in #general.");
  });

  it("shows the KvK recap as going after each KvK, never every week", () => {
    const html = render({
      post: "kvk",
      channels: [{ channel: "members", name: "general" }],
      day: "Saturday",
      from: "14:00",
      to: "14:15",
    });
    expect(html).toContain(">KvK recap</h3>");
    expect(html).toContain("On KvK day (Saturday), after the End is read.");
    expect(preview(html)).toBe(
      "After each KvK (Saturday), between 14:00 and 14:15 ST, in #general.",
    );
  });

  it("counts the title as the server does and marks one over 80 characters", () => {
    expect(render({ title: `  ${"x".repeat(80)}\u200B ` })).toContain("80 of 80 characters");
    const html = render({ title: "x".repeat(81) });
    expect(html).toMatch(/<input id="post-week-title"[^>]*aria-invalid="true"/);
    expect(html).toContain("Too long: keep it to 80 characters.");
  });
});
