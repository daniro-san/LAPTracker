import { describe, expect, it } from "vitest";

import { readMember } from "./discord";

const CONFIG = { clientId: "1", clientSecret: "secret", baseUrl: "https://discord.test/api" };

/** Discord with one account: its global display name and its nickname in the server. */
const discord =
  (globalName: string | null, nick: string | null): typeof fetch =>
  async (input) => {
    const url = String(input);
    if (url.endsWith("/oauth2/token")) return Response.json({ access_token: "token" });
    if (url.endsWith("/users/@me"))
      return Response.json({
        id: "200000000000000001",
        username: "kasoar_77",
        global_name: globalName,
      });
    return Response.json({ nick, roles: [] });
  };

const nameFrom = async (globalName: string | null, nick: string | null) => {
  const member = await readMember(
    discord(globalName, nick),
    CONFIG,
    "code",
    "https://x.test/cb",
    "9",
  );
  return member.ok ? member.displayName : member.code;
};

describe("the officer's name at sign-in (issue 334)", () => {
  it("is the server nickname, else the global display name, else the username", async () => {
    expect(await nameFrom("Kasoar", "Kasoar•Thorne")).toBe("Kasoar•Thorne");
    expect(await nameFrom("Kasoar", null)).toBe("Kasoar");
    expect(await nameFrom(null, null)).toBe("kasoar_77");
  });
});
