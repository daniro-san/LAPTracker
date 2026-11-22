# Callouts: an alliance's own line at the top of the posts LAPTracker makes for it (#713, part B)

**Approved**: 2026-11-22 - the owner approved the spike's recommendation for part B (callouts) in the chat, recorded by the orchestrator on #713 ("The owner approved the orchestrator's recommendations in the chat on 2026-11-22", answer 2: the Raid Shield summary takes a callout). Persona verdicts: [Validation](#validation).

Size: M (a migration, a new decision, a change to what reaches Discord).

## Problem

An alliance wants its own voice on the posts LAPTracker writes for it ("Let's go, family!" above the Raid Shield summary) without editing our templates. Today every post starts with our title.

What is different when this ships: in Alliance settings an officer saves one line per post type; the next post of that type starts with that line, shown as written and pinging no one.

## Shape

1. officer types a line in Alliance settings → Your line on our posts → `POST /api/w/[slug]/callouts` (new) → `requireWorkspace` (exists), `post_callouts` on, rate limit → `workspace_post_touches` (new) upsert, only when the text changed
2. a post is built (Raid Shield summary in the tick, weekly thanks and garrison post from the desk) → the post's callout is read only while `post_callouts` is on → `discordCallout` (new, pure) escapes it with `escapeDiscord` and breaks what `escapeDiscord` leaves live → it is the first line of the first message
3. Home's recent activity reads the row's `updated_by` / `updated_at` (new small source): "Ana changed the Raid Shield callout", never the text

| Front       | What changes                                                                                                                        |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| stored data | new table `workspace_post_touches`, migration `0071`; in D125's list, downloaded as `post-callouts.csv`, deleted with the workspace |
| domain      | `post_callouts` joins D134's catalog (Discord group), allowed and on by default                                                     |
| readers     | `lib/shield-post.ts`, `lib/private/thanks.ts`, `lib/private/garrison-post.ts`, Home's activity, the data download                   |

New: `workspace_post_touches(workspace_id → workspaces on delete cascade, post_key in (shield, thanks, garrison), callout text, updated_by → workspace_users on delete set null, updated_at)`, primary key `(workspace_id, post_key)`.

## Surface

| Route                         | In                                          | Out                                  | Status                                                                                     | Who                                                            |
| ----------------------------- | ------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| `POST /api/w/[slug]/callouts` | `{post: shield\|thanks\|garrison, callout}` | `{post, callout}` (the cleaned text) | 200; 400 `bad_request`, `too_long`; 401 `signed_out`; 403 `turned_off`; 429 `rate_limited` | officers of the workspace; a member's session or another's 401 |

## Landing

| One-way door         | Literal shape                                                                               | Alternative rejected                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| New table            | one row per workspace and post, the latest text only                                        | a history table: not asked; the activity line keeps who changed it last                            |
| What reaches Discord | officer text, escaped, mentions and links broken, `allowed_mentions: {parse: []}` unchanged | allowing links: a standing line on every weekly post is the easiest place to plant a phishing link |

## Criteria

### S1: Save a line (P1)

1. WHERE `post_callouts` is on, Alliance settings SHALL show a card "Your line on our posts" with one field per post the alliance can get: Raid Shield summary (while `shield_check` is on), Weekly thanks, Garrison post (while `garrison` is on); each with a visible label, a 44 px field, "n of 120" and a preview
2. WHEN an officer saves a line THEN the system SHALL store it trimmed, with line breaks and runs of spaces made one space and control and direction characters removed
   - 120 graphemes → saved; 121 → 400 `too_long`, nothing stored; an emoji with a skin tone counts 1
3. WHEN the saved text is empty THEN the post SHALL have no line
4. WHERE `post_callouts` is off (the owner's or the alliance's switch), the route SHALL answer 403 `turned_off` and the card SHALL not show; saved lines SHALL stay stored
5. The route SHALL refuse a member's session and another workspace's session with 401 `signed_out`, and more than 30 saves in 15 minutes per workspace with 429

### S2: The line on the post (P1)

1. WHEN the Raid Shield summary, the weekly thanks or the garrison post is posted to Discord and its line is saved and `post_callouts` is on THEN the line SHALL be the first line of the first message, above our title
2. The line SHALL be escaped with `escapeDiscord`, and SHALL also break `#` / `-#` at its start, `://`, `discord.gg/`, `<#` and `</`, so it renders literally, opens no link, and mentions no one; every message keeps `allowed_mentions: {parse: []}`
3. WHILE `post_callouts` is off, posts SHALL carry no line
4. The line SHALL never go to the members' board, a push notification, a public page, an AI or translation request, a log line or an analytics property
5. Notices SHALL take no line (see Out of scope)

### S3: Activity and data (P2)

1. WHEN a line changes THEN Home's recent activity SHALL say "{who} changed the Raid Shield callout" / "… the weekly thanks callout" / "… the garrison post callout", without the text; a save of the same text SHALL add nothing
2. "Download our data" SHALL include `post-callouts.csv`; the daily purge SHALL delete the rows with the workspace
3. A save that went through SHALL count as `ws_action` `post_callout` / `save`

## Out of scope

| Excluded                                      | Why                                                                                                                                                                                             |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A line on notices                             | A notice is the officers' own text from title to end, not a template of ours. Officers can already put any line at its top, in each language. One standing line would sit on unrelated notices. |
| A line on the members' board's thank-you card | The card is a note in the officers' own words already (D114); the spike's line is for Discord posts                                                                                             |
| The catalog posts (part C)                    | Not built yet; each will add its `post_key`                                                                                                                                                     |
| A history of earlier lines                    | Not asked; one row per post                                                                                                                                                                     |

## Validation

Quick persona check at 360 px (invented names), recorded in the handoff and the PR: three officers (an R5 in a hurry, an officer reading English as a second language, an officer in her 50s), an adversarial reviewer (abuse, mentions, blame) and a designer.
