import { describe, expect, it } from "vitest";

import { sanitiseEvent, scrubMessage } from "./sanitise";

const HOST = "https://laptracker-inky.vercel.app";

describe("PostHog before_send (D77)", () => {
  it("cuts the query string and hash from every URL-like property and drops what the SDK read from a query", () => {
    const out = sanitiseEvent(
      {
        event: "$autocapture",
        properties: {
          $current_url: `${HOST}/players?q=Ana#top`,
          $pathname: "/players",
          $referrer: "https://discord.com/channels/1?x=2",
          $initial_current_url: `${HOST}/events/compare?a=1&b=2`,
          $prev_pageview_pathname: "/players?q=Ana",
          $session_entry_url: `${HOST}/w/ogs/members?f=checkin&q=Ana`,
          $external_click_url: "https://example.com/p?ref=Ana",
          $elements_chain: 'a:attr__href="/players?q=Ana"href="/players?q=Ana"nth-child="1"',
          $elements: [
            { tag_name: "a", attr__href: "/events/compare?a=1#b" },
            { tag_name: "a", attr__href: "/w/ogs/members?f=r4&q=Ana" },
          ],
          $el_text: "Compare",
          $session_entry_utm_source: "discord",
          $session_entry_gclid: "abc",
          ph_keyword: "Ana",
        },
        $set_once: { $initial_referrer: "https://www.google.com/search?q=Ana" },
      },
      "/players",
    );
    expect(out.properties).toMatchObject({
      $current_url: `${HOST}/players`,
      $pathname: "/players",
      $referrer: "https://discord.com/channels/1",
      $initial_current_url: `${HOST}/events/compare`,
      $prev_pageview_pathname: "/players",
      $session_entry_url: `${HOST}/w/ogs/members`,
      $external_click_url: "https://example.com/p",
      $elements_chain: 'a:attr__href="/players"href="/players"nth-child="1"',
      $elements: [
        { tag_name: "a", attr__href: "/events/compare" },
        { tag_name: "a", attr__href: "/w/ogs/members" },
      ],
      $el_text: "Compare",
    });
    expect(out.properties).not.toHaveProperty("$session_entry_utm_source");
    expect(out.properties).not.toHaveProperty("$session_entry_gclid");
    expect(out.properties).not.toHaveProperty("ph_keyword");
    expect(out.$set_once).toEqual({ $initial_referrer: "https://www.google.com/search" });
    expect(JSON.stringify(out)).not.toMatch(/[?#]/);
  });

  it("names the area and the workspace from the event's own path, else the page's", () => {
    const area = (path: string, current = "/"): Record<string, unknown> =>
      sanitiseEvent({ event: "$pageview", properties: { $pathname: path } }, current).properties;
    expect(area("/")).toMatchObject({ area: "public" });
    expect(area("/players/42")).toMatchObject({ area: "public" });
    expect(area("/admin/members")).toMatchObject({ area: "admin" });
    expect(area("/w/ogs/members")).toMatchObject({ area: "workspace", workspace: "ogs" });
    expect(area("/")).not.toHaveProperty("workspace");
    expect(area("/")).not.toHaveProperty("section");
    // D115: the tab, from a closed list, never a member id or a draft number.
    expect(area("/w/ogs").section).toBe("home");
    expect(area("/w/ogs/members/12345").section).toBe("members");
    expect(area("/w/ogs/board").section).toBe("board");
    expect(area("/w/ogs/12345").section).toBe("other");
    expect(area("/admin").section).toBe("home");
    const snapshot = sanitiseEvent({ event: "$snapshot", properties: {} }, "/w/ogs?e=denied");
    expect(snapshot.properties).toMatchObject({ area: "workspace", workspace: "ogs" });
  });

  it("scrubs exception messages in every area and keeps the type, the words and the frames (D115)", () => {
    const out = sanitiseEvent(
      {
        event: "$exception",
        properties: {
          $pathname: "/w/ogs/thefts",
          $exception_list: [
            {
              type: "TypeError",
              value: "Member 'Ana' at 512, 384 failed: /api/x?token=1",
              stacktrace: {
                frames: [
                  { filename: `${HOST}/_next/static/a.js?v=1`, lineno: 3, function: "TheftForm" },
                ],
              },
            },
          ],
          $exception_values: ["Member 'Ana' at 512, 384 failed"],
          $exception_message: "mail ana.lee@example.com",
        },
      },
      "/w/ogs/thefts",
    ).properties;
    expect(out.$exception_list).toEqual([
      {
        type: "TypeError",
        value: "Member '…' at #, # failed: /api/x",
        stacktrace: {
          frames: [{ filename: `${HOST}/_next/static/a.js`, lineno: 3, function: "TheftForm" }],
        },
      },
    ]);
    expect(out.$exception_values).toEqual(["Member '…' at #, # failed"]);
    expect(out.$exception_message).toBe("mail [email]");
    expect(out).toMatchObject({ area: "workspace", workspace: "ogs", section: "thefts" });
  });

  it("keeps only the built-in members an engine quotes, and nothing else in quotes", () => {
    expect(scrubMessage("Cannot read properties of undefined (reading 'map')")).toBe(
      "Cannot read properties of undefined (reading 'map')",
    );
    expect(scrubMessage("undefined is not an object (evaluating 'e.children[0].length')")).toBe(
      "undefined is not an object (evaluating 'e.children[0].length')",
    );
    // A name in the engine's own quotes goes too: an object keyed by names, a field named after a player.
    expect(scrubMessage("Cannot read properties of undefined (reading 'Bramble')")).toBe(
      "Cannot read properties of undefined (reading '…')",
    );
    expect(scrubMessage("Cannot set properties of null (setting 'DragonSlayer99')")).toBe(
      "Cannot set properties of null (setting '…')",
    );
    expect(scrubMessage("undefined is not an object (evaluating 'byName.Bramble')")).toBe(
      "undefined is not an object (evaluating '…')",
    );
    expect(scrubMessage("crypto.randomUUID is not a function")).toBe(
      "crypto.randomUUID is not a function",
    );
    expect(scrubMessage("(reading 'Ana Lee')")).toBe("(reading '…')");
    expect(scrubMessage("No row for “Ana” in Thefts")).toBe("No row for “…” in Thefts");
    expect(scrubMessage('Unexpected token "Ž" in JSON at position 12')).toBe(
      'Unexpected token "…" in JSON at position #',
    );
    expect(scrubMessage("Loading chunk 4521 failed: https://x.app/_next/a.js?dpl=9")).toBe(
      "Loading chunk # failed: https://x.app/_next/a.js",
    );
  });

  it("closes each quote with its own kind and takes an apostrophe inside a word for one", () => {
    expect(scrubMessage(`can't access property "Bramble", x is undefined`)).toBe(
      `can't access property "…", x is undefined`,
    );
    expect(scrubMessage("it's 'Ana'")).toBe("it's '…'");
    expect(scrubMessage("Ana’s ‘Bramble’ and `Quill`")).toBe("Ana’s ‘…’ and `…`");
  });
});
