import { describe, expect, it } from "vitest";

import { MASKED_MESSAGE, sanitiseEvent } from "./sanitise";

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
    const area = (path: string, current = "/") =>
      sanitiseEvent({ event: "$pageview", properties: { $pathname: path } }, current).properties;
    expect(area("/")).toMatchObject({ area: "public" });
    expect(area("/players/42")).toMatchObject({ area: "public" });
    expect(area("/admin/members")).toMatchObject({ area: "admin" });
    expect(area("/w/ogs/members")).toMatchObject({ area: "workspace", workspace: "ogs" });
    expect(area("/")).not.toHaveProperty("workspace");
    const snapshot = sanitiseEvent({ event: "$snapshot", properties: {} }, "/w/ogs?e=denied");
    expect(snapshot.properties).toMatchObject({ area: "workspace", workspace: "ogs" });
  });

  it("replaces exception messages on the workspace and /admin, and cuts URLs in public ones", () => {
    const exception = (path: string) =>
      sanitiseEvent(
        {
          event: "$exception",
          properties: {
            $pathname: path,
            $exception_list: [
              {
                type: "Error",
                value: "Ana at 512, 384 failed: /api/x?token=1",
                stacktrace: { frames: [{ filename: `${HOST}/_next/static/a.js?v=1`, lineno: 3 }] },
              },
            ],
            $exception_values: ["Ana at 512, 384 failed"],
          },
        },
        path,
      ).properties;
    const masked = exception("/w/ogs");
    expect(masked.$exception_list).toEqual([
      {
        type: "Error",
        value: MASKED_MESSAGE,
        stacktrace: { frames: [{ filename: `${HOST}/_next/static/a.js`, lineno: 3 }] },
      },
    ]);
    expect(masked.$exception_values).toEqual([MASKED_MESSAGE]);
    expect(exception("/admin").$exception_list).toMatchObject([{ value: MASKED_MESSAGE }]);
    expect(exception("/players").$exception_list).toMatchObject([
      { value: "Ana at 512, 384 failed: /api/x" },
    ]);
  });
});
