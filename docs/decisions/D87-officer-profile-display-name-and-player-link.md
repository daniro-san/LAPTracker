## D87 — The officer's profile: a chosen display name, "This is me" and the theme in the workspace (2026-11-16, owner, 11n, issue #334)

The owner's first real sign-in on production asked for three things: the desk should call officers by their server nickname, officers should be able to change that name, and an officer may say which player in the alliance they are. This adds to D73 (sign-in choices), which stays as written: at sign-in, `workspace_users.display_name` is the server nickname, else the global display name, else the username.

- **The chosen name is kept apart.** The officer edits their name in the settings sheet that opens from their name in the header. The name is trimmed and must have 1 to 32 characters, counted as Unicode code points. The server is the only check; the field has no `maxLength`. The name is stored in `workspace_users.chosen_name`. `display_name` stays what Discord gave at the last sign-in, so the next sign-in never overwrites the officer's choice. The header shows `chosen_name`, else `display_name`.
- **"This is me" accepts only the workspace's own alliance.**
  - `workspace_users.player_uid` stores the officer's player. A uid is accepted only when it is in the newest usable daily roster of the workspace's alliance (`union_id = access.unionId`, D71). Any other uid gets 400 `not_in_alliance`.
  - The sheet suggests players with the D74 name matcher on the shown name. A search filters the same roster by name key in the browser.
  - Each candidate shows its rank and might, so look-alike names can be told apart. The officer confirms with "That's me" and can remove the link at any time ("This isn't me").
  - What is read from the roster: uid, name, might (the daily roster's public arrays), and `rank_code` and `rank_label` from that row's `raw_json`. No blocked roster field (D71, D76) is read.
- **The theme reuses the public site's `theme` cookie.** The sheet offers Same as this device, Light and Dark. Light and Dark write `theme=light|dark` for a year; Same as this device removes the cookie. The root layout already renders `data-theme` from that cookie on the server, so one choice covers the desk and the public site with no flash.
- **Nothing is logged.** The profile route (`GET`/`POST /api/w/[slug]/profile`) logs nothing and sends no PostHog event. Its writes are same-origin JSON only (D71). The sheet sits under the workspace's replay mask (D77).
- **Retention** of `chosen_name` and `player_uid` follows D71's open retention question.

- Amendment (2026-11-21, issue 487, D142): members use "This is me" too, on their own page on the members' board. An officer's link is `approved` at once; every member's link waits for an officer's Approve. One approved link per player in a workspace: a player another user holds is refused with `409 taken`.
