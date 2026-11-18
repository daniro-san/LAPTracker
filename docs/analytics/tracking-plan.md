# Tracking plan (D115)

What we send to PostHog (project 741657, US cloud, D77), which product question each event answers, and the insights and funnels to build from it. An event that answers no question here is not added. `lib/analytics/events.test.ts` fails `pnpm check` if an event, a desk feature or a desk action in the code is missing from this page.

## Rules for every event

- No member values, no names, no free text, no roster private fields (CLAUDE.md, D71, D76), no Discord id, no email, no ids beyond the pseudonymous person.
- Properties are enums from a closed list, booleans or counts. In the browser, `lib/analytics/events.ts` types every property as a closed list of words, and `events.test.ts` fails if one could take any string or a number. On the server, `lib/analytics/server.ts` is the closed list (`DESK_FEATURES`, `DESK_ACTIONS`); `server.test.ts` and `lib/private/desk-action.test.ts` check the payloads.
- `before_send` (`lib/analytics/sanitise.ts`) adds `area` (`public`, `workspace`, `admin`), `workspace` (the slug) and `section` (the tab) from the event's own path, and cuts query strings and hashes from every URL.
- People first (D75): nothing here ranks officers or members. Events count use of the desk, not who did the most. No insight below breaks down by person.

## Who is counted

| Where the page load starts                                                         | Distinct id                                                                                                      | Person profile                                      | Replay                           |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | -------------------------------- |
| A public page, visitor has not answered the analytics question or said "No thanks" | PostHog's cookieless daily hash (IP, user agent, host, a daily salt PostHog deletes)                             | none                                                | none                             |
| A public page, visitor said "Allow" on this device                                 | PostHog's own id, kept in its cookie and local storage                                                           | none                                                | 25 % of page loads (D77 masking) |
| `/w/<slug>` (desk or board), signed in                                             | `ws_` + 32 hex: HMAC of the workspace user id under a key derived from `CRON_SECRET` (`lib/analytics/person.ts`) | `tier` (`officer` or `member`) and `workspace` only | yes, masked (D77)                |
| `/admin`, or `/w` signed out                                                       | a random id for this page load                                                                                   | none                                                | yes, masked (D77)                |

Daily unique visitors on public pages are real (one hash per visitor per day, or one id for those who allowed the cookie). Desk and board users are real across days and devices. Sign-out calls `reset`. `identify` does nothing on a cookieless page load.

## The analytics question (public pages)

| Product question                          | Event                                    | Properties | Sent from                           |
| ----------------------------------------- | ---------------------------------------- | ---------- | ----------------------------------- |
| How many visitors allow the cookie?       | `$opt_in`                                | none       | posthog-js, when "Allow" is pressed |
| How many visitors are counted without it? | any event with `$cookieless_mode` = true | none       | posthog-js                          |

Insight: **Consent rate** — Trends, `$opt_in` unique users ÷ `$pageview` unique users on `area = public`, weekly.

## Desk actions (server, every write that went through)

One event, `ws_action`, sent by `lib/private/desk-action.ts` from each private write route after a 2xx answer, on the officer's pseudonymous id. Properties: `feature` and `action`, `tier` = `officer`, `area` = `workspace`. A refused write (409, 400, signed out) is not counted. A write repeated with the same request id after a lost answer (D100) is counted again: the lib functions answer a replay exactly like the first write, so the route cannot tell them apart. Such repeats are rare.

| `feature`          | `action` values                                                                                                                                                                                                                                                               | Route                         | Product question                                                                   |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------- |
| `calendar`         | `add`, `edit`, `delete`                                                                                                                                                                                                                                                       | `/api/w/[slug]/calendar`      | Do officers keep the week's calendar and caravans?                                 |
| `theft`            | `add`, `delete`, `record` (a follow-up on an attacker)                                                                                                                                                                                                                        | `/thefts`                     | Is the thefts log used and followed up?                                            |
| `roll_call`        | `add`, `mark`, `rest`, `undo`, `team`                                                                                                                                                                                                                                         | `/roll-call`                  | Are roll calls marked, by tap or with "the rest"?                                  |
| `follow_up`        | `record`, `undo`                                                                                                                                                                                                                                                              | `/follow-up`                  | Do officers work the weekly follow-up list?                                        |
| `new_member`       | `add`, `link`, `delete`                                                                                                                                                                                                                                                       | `/pending`                    | Are new members added by hand and matched?                                         |
| `member_facts`     | `save`                                                                                                                                                                                                                                                                        | `/members/[uid]/facts`        | Do officers keep member facts up to date?                                          |
| `sheet_import`     | `import`                                                                                                                                                                                                                                                                      | `/import`                     | Was the one-time sheet import used?                                                |
| `notice`           | `add`, `edit`, `delete`, `undo` (the deleter's Undo, 60 s), `restore` (from the trash, D118)                                                                                                                                                                                  | `/notices`, `/notices/delete` | Are notices written and kept, and are test notices cleaned up?                     |
| `notice_ai`        | `translate`, `improve`, `fit`                                                                                                                                                                                                                                                 | `/notices/draft`              | Which writing helps are used?                                                      |
| `notice_review`    | `ask`, `approve`                                                                                                                                                                                                                                                              | `/notices/reviews`            | Do officers review each other's notices?                                           |
| `notice_publish`   | `publish`                                                                                                                                                                                                                                                                     | `/notices/publish`            | Are notices published to Discord?                                                  |
| `screenshot`       | `add` (drafts made from pictures: a reading that went to review), `paste` (a draft from Paste updates), `read_text` (one picture read to text for a paste box, "Read from a screenshot": an attempt that returned text; nothing is saved, the officer still checks and saves) | `/shots`, `/shots/read`       | Are screenshots the way data comes in? A saved one is `screenshot_draft` / `save`. |
| `screenshot_draft` | `save`, `discard`, `retype`                                                                                                                                                                                                                                                   | `/shots/[id]`                 | Are drafts saved or thrown away?                                                   |
| `start_here`       | `edit`                                                                                                                                                                                                                                                                        | `/start-here`                 | Is the board's Start here kept?                                                    |
| `profile`          | `rename`, `link`, `unlink`                                                                                                                                                                                                                                                    | `/profile`                    | Do officers set their name and "This is me"?                                       |
| `thanks`           | `draft`, `share`, `take_down`                                                                                                                                                                                                                                                 | `/thanks`, `/thanks/draft`    | Is the weekly thanks drafted and shared?                                           |

Insights:

- **Desk adoption by feature** — Trends, `ws_action` unique users, breakdown `feature`, weekly. Answers "which features officers use".
- **Actions per feature** — Trends, `ws_action` total count, breakdown `feature` then `action`, weekly.
- **Active officers** — Trends, unique users of any event with `tier = officer`, daily and weekly; Stickiness, `ws_action`, weekly.
- **Retention** — Retention, first event `ws_sign_in_completed`, return event `ws_action`, weekly.

## Desk outcomes (browser)

| Product question                                               | Event                                                                                                  | Properties                                                                                                                                                                       | Sent from                                    |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Which tabs do officers open, and how often?                    | `$pageview`                                                                                            | `section`: `home`, `members`, `roll-call`, `calendar`, `notices`, `thefts`, `follow-up`, `shots`, `import`, `start-here`, `how-to`, `board`, `no-access`, `other`; person `tier` | page views, `section` added in `before_send` |
| Do officers sign in, and finish the first-use cards?           | `ws_sign_in_completed`, `ws_first_use_done`, `ws_first_use_skipped`                                    | none                                                                                                                                                                             | sign-in callback fragment; first-use cards   |
| What kind of screenshot is sent?                               | `ws_screenshot_sent`                                                                                   | `kind`: the import types, `unrecognised`, `map`                                                                                                                                  | Send screenshots                             |
| What happens to a screenshot read: saved, discarded or failed? | `ws_draft_saved`, `ws_draft_discarded`, `ws_screenshot_failed`                                         | `kind`; `stage`: `read`, `drafts`                                                                                                                                                | draft review; Send screenshots               |
| Does "Paste updates" work?                                     | `ws_updates_pasted`                                                                                    | `outcome`: `draft`, `nothing`, `failed`                                                                                                                                          | Members → Paste updates                      |
| Does "Read from a screenshot" read?                            | `ws_text_read`                                                                                         | `place`: `paste_updates`, `facts`; `outcome`: `read`, `failed`, `busy`                                                                                                           | the button beside a paste box                |
| Are Translate and Fit used, and do they fail?                  | `ws_notice_translated`, `ws_notice_fit`, `ws_notice_ai_failed`                                         | `action`: `translate`, `improve`, `fit`                                                                                                                                          | notice editor                                |
| Are reviews asked and answered?                                | `ws_review_requested`, `ws_review_approved`                                                            | `scope`: `notice`, `language`; `to`: `team`, `officer`                                                                                                                           | notice page                                  |
| Are roll calls marked?                                         | `ws_roll_call_marked`                                                                                  | `how`: `tap`, `rest`                                                                                                                                                             | Roll call                                    |
| Are notices published?                                         | `ws_notice_published`                                                                                  | `audience`: `members`, `leaders`                                                                                                                                                 | Publish to Discord                           |
| Is the weekly thanks shared, and where?                        | `ws_thanks_shared`                                                                                     | `to`: `board`, `discord`, `game` (copied)                                                                                                                                        | the share-thanks sheet (D114)                |
| Are the Members tools used?                                    | `ws_filter_used`, `ws_copy_spreadsheet`, `ws_facts_saved`, `ws_sheet_imported`, `ws_language_switched` | `filter`; `language`                                                                                                                                                             | D77, D80, D98                                |

Insights:

- **Tabs opened** — Trends, `$pageview` with `area = workspace`, breakdown `section`, weekly, total and unique users.
- **Screenshot funnel** — Funnel: `ws_screenshot_sent` → `ws_draft_saved` (or `ws_action` `screenshot_draft` / `save`), within 1 day; breakdown `kind`. A second funnel ends on `ws_draft_discarded`; `ws_screenshot_failed` trends by `stage` show where reading breaks.
- **Notice funnel** — Funnel: `ws_action` `notice` / `add` → `ws_notice_translated` → `ws_notice_published`, within 7 days.
- **Paste and read** — Trends, `ws_updates_pasted` and `ws_text_read` by `outcome`.
- **Thanks** — Trends, `ws_thanks_shared` by `to`, weekly; funnel `ws_action` `thanks` / `draft` → `ws_thanks_shared`.

## Members' board

| Product question                       | Event                     | Properties                                                                                            | Sent from                                           |
| -------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Do members sign in?                    | `ws_sign_in_completed`    | person `tier` = `member`                                                                              | sign-in callback fragment                           |
| Do members come back to the board?     | `$pageview`               | `section` = `board`, person `tier` = `member`                                                         | page views                                          |
| Which board sections do members reach? | `ws_board_section_viewed` | `board_section`: `week`, `notices`, `start_here` (not `section`, which `before_send` sets to the tab) | the board, once per page load per section on screen |

Insights:

- **Board adoption** — Trends, `$pageview` unique users with `section = board` and person `tier = member`, weekly; Stickiness on the same.
- **Board sections** — Trends, `ws_board_section_viewed` by `board_section`.
- **Member funnel** — Funnel: `ws_sign_in_completed` (tier member) → `ws_board_section_viewed` (`start_here`).

## Server-side signals

| Product question                                                | Event                  | Properties                                                                                                                   | Sent from                                            |
| --------------------------------------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Are the Discord commands used?                                  | `discord_command_used` | `command`: `send_to_laptracker`, `translate_for_me`, `translate_for_everyone`                                                | `/api/discord/interactions`                          |
| What breaks in the browser, and where?                          | `$exception`           | type, scrubbed message, stack frames, `section`, `boundary` (`page`, `root`)                                                 | autocapture, `app/error.tsx`, `app/global-error.tsx` |
| What breaks on the server?                                      | `$exception`           | `type` (error class), `kind`, `route` (pattern)                                                                              | `recordAppError`                                     |
| What does the AI cost, and how often does it fall back or fail? | `$ai_generation`       | `$ai_model`, `$ai_input_tokens`, `$ai_output_tokens`, `$ai_latency`, `fallback`, `$ai_is_error`, `$ai_error`, `$ai_trace_id` | every Groq request                                   |

Insights: **Discord commands** by `command`, weekly; **Errors** in Error tracking, filtered by `section`; **AI cost and latency** in LLM analytics (p50/p95 `$ai_latency`, sum of tokens by `$ai_model`, share with `fallback`).

## Changed in D115

- "Paste updates" sent `ws_screenshot_sent` with `kind: member_update`, which counted a paste as a screenshot. It now sends `ws_updates_pasted`.
- Exception messages are scrubbed in every area instead of replaced by `[masked]` on the workspace and `/admin`.
- Public pages ask the analytics question; the 25 % public replay holds only for visitors who said "Allow".

## Not tracked, on purpose

- Who marked, saved, thanked or was thanked; any member's value; anything typed.
- Per-member actions on `/admin`.
- OpenTelemetry traces (D115: not now).
