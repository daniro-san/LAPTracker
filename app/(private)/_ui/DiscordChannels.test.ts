// Each Discord channel card tells officers where the posts' name and picture come from (issue 713): none of
// our posts sets them, so Discord shows the webhook's own. Invented webhook state.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { WORKSPACE_DICTIONARIES } from "@/lib/private/dictionary";

import { DiscordChannels } from "./DiscordChannels";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined }) }));

describe("the Discord channel cards", () => {
  it("say on every card that the webhook's name and picture show, and where to change them", () => {
    const t = WORKSPACE_DICTIONARIES.en;
    const html = renderToStaticMarkup(
      createElement(DiscordChannels, {
        slug: "ogs",
        saving: true,
        head: "discord.hooks.head",
        t,
        channels: [
          { channel: "leaders", state: "set", name: "leaders-room" },
          { channel: "members", state: "none", name: null },
          { channel: "shield", state: "reenter", name: null },
        ],
      }),
    );
    expect(html.split(t["discord.channel.look"]).length - 1).toBe(3);
  });
});
