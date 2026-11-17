import { describe, expect, it, vi } from "vitest";

import { IMPORT_COMMAND, registerImportCommand } from "./import-command";

const env = {
  DISCORD_CLIENT_ID: "900000000000000001",
  DISCORD_CLIENT_SECRET: "client-secret-for-tests",
  DISCORD_API_BASE_URL: "https://discord.test/api/",
};
const OGS = "1544808864262914060";
const OTHER = "1544808864262914061";

describe("registerImportCommand (D96)", () => {
  it("takes a client-credentials token, then PUTs the command in each guild and returns each status", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetcher = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} });
      if (String(url).endsWith("/oauth2/token")) {
        return Response.json({ access_token: "bearer-for-tests", token_type: "Bearer" });
      }
      return String(url).includes(OGS)
        ? Response.json([{ id: "1", ...IMPORT_COMMAND }])
        : Response.json({ message: "Missing Access", code: 50001 }, { status: 403 });
    });

    const result = await registerImportCommand(env, fetcher as typeof fetch, [OGS, OTHER]);

    expect(result).toEqual({
      ok: true,
      guilds: [
        { guildId: OGS, status: 200 },
        { guildId: OTHER, status: 403 },
      ],
    });
    expect(JSON.stringify(result)).not.toContain("secret");
    expect(JSON.stringify(result)).not.toContain("bearer-for-tests");

    const [token, ...puts] = calls;
    expect(token?.url).toBe("https://discord.test/api/oauth2/token");
    const basic = Buffer.from(`${env.DISCORD_CLIENT_ID}:${env.DISCORD_CLIENT_SECRET}`).toString(
      "base64",
    );
    expect(new Headers(token?.init.headers).get("authorization")).toBe(`Basic ${basic}`);
    const form = new URLSearchParams(String(token?.init.body));
    expect(form.get("grant_type")).toBe("client_credentials");
    expect(form.get("scope")).toBe("applications.commands.update");

    expect(puts.map((p) => [p.init.method, p.url])).toEqual([
      [
        "PUT",
        `https://discord.test/api/applications/${env.DISCORD_CLIENT_ID}/guilds/${OGS}/commands`,
      ],
      [
        "PUT",
        `https://discord.test/api/applications/${env.DISCORD_CLIENT_ID}/guilds/${OTHER}/commands`,
      ],
    ]);
    for (const put of puts) {
      expect(new Headers(put.init.headers).get("authorization")).toBe("Bearer bearer-for-tests");
      expect(JSON.parse(String(put.init.body))).toEqual([{ name: "Send to LAPTracker", type: 3 }]);
    }
  });

  it("refuses without calling Discord when a credential is missing", async () => {
    const fetcher = vi.fn();
    for (const missing of ["DISCORD_CLIENT_ID", "DISCORD_CLIENT_SECRET"] as const) {
      const result = await registerImportCommand(
        { ...env, [missing]: undefined },
        fetcher as typeof fetch,
        [OGS],
      );
      expect(result).toEqual({ ok: false, code: "no_credentials" });
    }
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("answers the token's refusal or no answer as discord_token, with no PUT", async () => {
    const refused = vi.fn(async () => new Response("", { status: 401 }));
    expect(await registerImportCommand(env, refused as typeof fetch, [OGS])).toEqual({
      ok: false,
      code: "discord_token",
      status: 401,
    });
    expect(refused).toHaveBeenCalledTimes(1);
    const down = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    expect(await registerImportCommand(env, down as typeof fetch, [OGS])).toEqual({
      ok: false,
      code: "discord_token",
      status: 0,
    });
    expect(down).toHaveBeenCalledTimes(1);
  });
});
