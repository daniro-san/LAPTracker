import { describe, expect, it } from "vitest";
import { z } from "zod";

import { PRIVATE_VALUE, REDACTED, redact, redactPrivate } from "./redact";

describe("redact", () => {
  it("masks secret headers, known secret values and LAP keys at any depth", () => {
    const input = {
      headers: { Authorization: "Bearer abc", "x-edit-pin": "123456" },
      url: "https://example.test/?pin=987654",
      nested: [{ note: "key lap_AbCdEf0123456789 leaked" }],
      count: 3,
    };
    expect(redact(input, ["987654"])).toEqual({
      headers: { Authorization: REDACTED, "x-edit-pin": REDACTED },
      url: `https://example.test/?pin=${REDACTED}`,
      nested: [{ note: `key ${REDACTED} leaked` }],
      count: 3,
    });
  });
});

describe("redactPrivate", () => {
  // Invented values: a photo id, coordinates 98765/54321, a last-online time and a daily tech of 4321.
  const AVATAR = "https://phs-image.globallap.com/head/7a1b9c.png";
  const LEAKS = ["98765", "54321", "2026-11-20", "4321", "7a1b9c", "globallap"];

  it("replaces private roster values in every shape and keeps the rest of the text", () => {
    const text = [
      `JSON {"uid":7,"nick_name":"Invented Bramble","x":98765,"y": 54321,"last_online_at":"2026-11-20T10:00:00Z","daily_tech":4321,"avatar_url":"${AVATAR}","power":123}`,
      `escaped {\\"x\\":98765,\\"last_online_at\\":\\"2026-11-20T10:00:00Z\\",\\"power\\":123}`,
      `pairs x=98765&y=54321 last_online_at=2026-11-20T10:00:00Z daily_tech=4321 kills=9`,
      `inspect { x: 98765, y: 54321, lastOnlineAt: 2026-11-20T10:00:00.000Z, dailyTech: 4321, joined_at: '2026-11-20' }`,
      `path members.3.x: 98765`,
      `pg Key (union_id, x)=(67111155, 98765) already exists.`,
      `zod [{"code":"invalid_type","path":["members",3,"y"],"message":"Invalid input","input":"54321"},{"code":"too_big","maximum":5,"path":["kills"],"input":77}]`,
      `photo fetch failed for ${AVATAR} and //cdn.phs-image.globallap.com/b.png`,
    ].join("\n");
    const out = redactPrivate(text);
    for (const leak of LEAKS) expect(out).not.toContain(leak);
    // What is not private stays: names, other keys and their values, the error's own words.
    for (const kept of [
      '"nick_name":"Invented Bramble"',
      '"power":123',
      "kills=9",
      "Key (union_id, x)=(67111155, …) already exists.",
      '"maximum":5,"path":["kills"],"input":77',
      '"message":"Invalid input"',
      "photo fetch failed for … and …",
    ])
      expect(out).toContain(kept);
    expect(out).toContain('"x":…,"y": …,"last_online_at":…,"daily_tech":…,"avatar_url":…');
    expect(out).toContain("x=…&y=… last_online_at=… daily_tech=…");
  });

  it("leaves keys that only contain a private key's name, our daily_ words and SQL placeholders", () => {
    const text =
      'max: 3, is_online=1, active_members: 12, box=4, daily_read: 2026-11-21, "daily_rosters" where "x" = $1 at dailyReadDue (lib/tick.ts:84:9)';
    expect(redactPrivate(text)).toBe(text);
  });

  it("drops a query's parameters, any-case keys, Zod issues in escaped JSON or a union, and private object keys", () => {
    const union = z
      .object({ x: z.union([z.number(), z.boolean()]) })
      .safeParse({ x: "98765" }, { reportInput: true });
    const zodMessage = String(union.error?.message);
    const text = [
      'Failed query: insert into "notice_edits" ("text", "x") values ($1, $2)\nparams: Invented Bramble wrote this,98765',
      `cause ${JSON.stringify(JSON.stringify(JSON.parse(zodMessage)))}`,
      zodMessage,
      "X: 98765, Last_Online_At=2026-11-20T10:00:00Z",
    ].join("\n");
    const out = redactPrivate(text);
    for (const leak of [...LEAKS, "Invented Bramble"]) expect(out).not.toContain(leak);
    expect(out).toContain("values ($1, $2)\nparams: …");
    expect(redact({ x: 98765, nested: { lastOnlineAt: "2026-11-20" }, count: 3 })).toEqual({
      x: PRIVATE_VALUE,
      nested: { lastOnlineAt: PRIVATE_VALUE },
      count: 3,
    });
  });

  it("fails closed on a value with no end, and takes a time written with a space whole", () => {
    const long = "9".repeat(600);
    const cases: [string, string][] = [
      ['{"uid":7,"last_online_at":"2026-11-20T10:0', '{"uid":7,"last_online_at":…'],
      [`{"x":"${long}","power":1}`, '{"x":…'],
      ['{\\"y\\":\\"54321', '{\\"y\\":…'],
      ["Key (union_id, x)=(67111155, 987", "Key (union_id, x)=(…"],
      ["last_online_at=2026-11-20 10:00:00+00 then", "last_online_at=… then"],
      ["joined_at: 2026-11-20 10:00:00.123Z.", `joined_at: ${PRIVATE_VALUE}.`],
      [
        "lastOnlineAt: Fri Nov 20 2026 10:00:00 GMT+0000 (Coordinated Universal Time), power 1",
        "lastOnlineAt: …, power 1",
      ],
    ];
    for (const [text, out] of cases) expect(redactPrivate(text)).toBe(out);
  });

  // 100 kB of each shape that made an earlier version quadratic: a quadratic redactor would not finish inside
  // the test's timeout. Outputs, not times, are asserted.
  it("reads adversarial text in one pass and redacts it as it would short text", () => {
    const n = 100_000;
    const backslashes = "\\".repeat(n);
    const cases: [string, string][] = [
      [
        "a.".repeat(n / 2) + "phs-image.globallap.co",
        "a.".repeat(n / 2) + "phs-image.globallap.co",
      ],
      ["phs-image.globallap.com ".repeat(n / 24), "… ".repeat(n / 24)],
      [`x:\\"${backslashes}`, "x:…"],
      [`${backslashes}"path":["x"],"input":"98765"`, `${backslashes}"path":["x"],"input":…`],
      ['"path":['.repeat(n / 8), '"path":['.repeat(n / 8)],
      ["{".repeat(n), "{".repeat(n)],
      ["Key (" + "x,".repeat(n / 2), "Key (" + "x,".repeat(n / 2)],
      ['x:\\"'.repeat(n / 4), "x:…".repeat(n / 8)],
      ["x:[".repeat(n / 3), "x:…"],
    ];
    for (const [text, out] of cases) expect(redactPrivate(text)).toBe(out);
  });
});
