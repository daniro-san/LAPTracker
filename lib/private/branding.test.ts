// The branding on a webhook message (issue 462, D167): a channel's look goes into every message of a post as
// Discord's per-message `username` and `avatar_url`, and a channel without one posts as before.
import { describe, expect, it } from "vitest";

import { postMessages } from "./notice-publish";

const sent = async (look?: { username: string; avatar_url: string }) => {
  const bodies: Record<string, unknown>[] = [];
  const doFetch = (async (_url: string, init: { body: string }) => {
    bodies.push(JSON.parse(init.body) as Record<string, unknown>);
    return new Response(null, { status: 204 });
  }) as unknown as typeof fetch;
  const channel = {
    url: "https://discord.com/api/webhooks/1/x",
    name: "news",
    forum: false,
    ...(look && { look }),
  };
  await postMessages(doFetch, channel, "Title", ["one", "two"]);
  return bodies;
};

describe("a webhook post's name and avatar", () => {
  it("carries the workspace's title and icon on every message", async () => {
    const look = {
      username: "[ZZZ] Desk",
      avatar_url: "https://laptracker.test/img/desk/zzz?size=512",
    };
    const bodies = await sent(look);
    expect(bodies).toHaveLength(2);
    for (const b of bodies) expect(b).toMatchObject({ ...look, allowed_mentions: { parse: [] } });
  });

  it("sends neither without a look", async () => {
    for (const b of await sent()) expect(Object.keys(b)).not.toContain("username");
  });
});
