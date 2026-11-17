## D98 — Members list: compact rows, filters and orders in the browser, details read on open, and the Server time / My time switch (2026-11-17, owner, 11o, issue #337)

Why: the Members tab showed one tall card per member (4 to 5 per phone screen) and filtered on the server. Leadership needs to find people among 100+ members on a phone. The persona panel chose variant A, and a filters study chose the filters. The owner then answered its three questions on 2026-11-17: offer night as well as daytime, sort by kills both ways, and count languages in "Info to ask".

- **Shape.**
  - Compact rows: the photo and frame as on the public pages (`PlayerAvatar`, `/img/avatar/[uid]` and `/img/frame/[id]`, D22, D65, D66), rank, name, one number for the order, and the week's donations.
  - A second line appears only when it has something to say: the status with its evidence, what is still to ask, and the member's own time.
  - 25 rows, then "Show 25 more". There is no infinite scroll and no windowing.
  - In the default order, "Check in and Needs help" comes first under its own heading and is never paged.
  - A native `<dialog>` sheet for a member, and another for "Filter and order". Each sheet adds one history entry, so the phone's back button closes it.
  - Variant D, a sortable table, was vetoed.
- **Filters.** They combine with each other and with the search (AND). Every count is the size of the list that option would give, with the search and the other filters applied.
  - R4 and R5 (chip).
  - Info to ask (chip): a member with no main squad, troops, AD Tech, time zone or languages recorded. A cleared fact counts as not recorded.
  - Who (sheet): Check in, Needs help, On a break or New.
  - Daytime or Night for them at hh ST (sheet). Daytime is 08:00–22:59 on the member's own clock (`DAY_FROM`, `DAY_TO`). A member with no time zone matches neither and is counted on a "Not shown" line.
  - Language (sheet): only the languages someone has, with counts.
  - Removed: All, New, Check in and Missing info as chips. Old `?f=` links map onto the new filters.
- **Orders.** Rank then might (default), might high→low and low→high, kills high→low and low→high, main squad high→low. In every order, members with no value ("—") and members on a break each come after the others, in their own labelled group. "—" is never sorted as 0 (D75).
- **State.**
  - The address holds the filters, the search and the order (`replaceState`), so a reload or a shared link shows the same list.
  - Only the order is remembered on this browser (`localStorage` `ws.members.order`, inside try/catch).
  - Opening the tab without an address shows everyone.
- **Where it runs.** `lib/private/members-list.ts` is pure and browser-safe. The page sends one small row per member (no map position, no last online, no photo URL). The browser filters, counts and orders them. The search uses `fold` (accents and case); past names are not searched yet.
- **Details read on open.** `GET /api/w/[slug]/members/[uid]` answers the card after `requireWorkspace`, and only for a member of the workspace's own alliance. The answer is `private, no-store` and nothing is logged. The map position and last online time are therefore only in the opened sheet (D71).
- **Kills.** Lifetime kills now come from the end-of-day read's `kills` (a public field), and before the first end-of-day read from the newest roster's arrays.
- **Time.**
  - "Server time (ST) first / My time first" in the officer's settings sheet. It is one per-browser choice (`localStorage` `ws.clock`), and server time is the default.
  - It changes which of the two times comes first wherever the workspace shows a server time beside the viewer's own (`Times` and `TimePair` in `YourTime.tsx`): the calendar week, the caravans, the thefts log and the hour picker. Both times always stay on screen.
  - Forms still take times in ST.
  - The calendar legend now says "the other time is your own".
  - Each member with a known time zone shows their own time now on their row ("14:05 their time"). With a time filter on, the row shows their time at that hour instead.
  - `Intl` only; no new dependency.
- **Analytics.** `ws_filter_used` keeps its closed list of names: r4, ask, who, daytime, night, language and order_*. No hour, language or search text is sent.

- **Amended 2026-11-17 (review of PR #360).**
  - **Info to ask has three kinds.** The chip lists anyone with a fact missing (`ask=1`). Each "Not shown" line has its own kind: "no time zone recorded" (`ask=timeZone`) and "no languages recorded" (`ask=languages`).
    - "See who" sets the matching kind.
    - The count line says "No time zone · n" or "No languages · n".
  - **The Language filter counts who it cannot judge.** Members with no languages get a "Not shown" line, as members with no time zone do for the time filter.
  - **The count line names every filter on:** R4 and R5, Info to ask (or its kind), Who, the time, the language and the order.
  - **Past names are searched.** They are the names a member used in this alliance's rosters (`namesSeen`). A row found by a past name says "was …".
  - **"Show more" counts the Check in and Needs help rows.** The heading's rows count toward the 25, so a long heading no longer pushes the list below the screen.
  - **Before the first end-of-day read,** Who shows "—" for Check in, Needs help and New (D75: nothing is computed then).
  - **Photos, frames and past names are read by the list page only** (`withListExtras`; `photosOf` in `lib/queries/photo.ts`, built on `photoColumns`). `membersView` and the card route read none of them.
    - A member with no stored event roster row has no photo or frame on the list, as on the public pages.
  - **The card's words live in `lib/private/member-card.ts`** (`memberCard`). The route only checks the session, reads the address, calls it and answers.
  - **Low-first orders** show "Lowest first, to see who may need help growing. Not a ranking." While one is chosen, "Copy for spreadsheet" copies the members on screen in rank order.
  - **The time filter puts the hour first** ("At (ST)", options "18:00 ST"). The two radios read "Daytime for them · n" and "Night for them · n". "Daytime" is said as 08:00 to 23:00, which is the same window.
  - **The switch** reads "My time first (this phone: {zone}, {hh:mm} now)".
