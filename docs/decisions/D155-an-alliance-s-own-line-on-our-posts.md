## D155 — An alliance's own line on our posts: one line per post, at most 120 graphemes, never translated, posted above our title so it pings and links no one; notices take none (2026-11-22, owner, issue 713 part B; amends D108, D114, D121, D125, D134, D137, D147)

Why: the owner (issue 713, 2026-11-22) wants each alliance to add its own touch to what we post for it, without editing our templates, for example "Let's go, family!" before the Raid Shield summary. The spike's recommendation for part B was approved in the chat the same day (recorded by the orchestrator on issue 713); answer 2: the Raid Shield summary takes a line like every other post.

**What it is.** Per post type, an alliance saves one line (the callout). Officers write it; it is at most 120 graphemes (an emoji with its skin tone is one; `Intl.Segmenter`), never translated, and posted as the first line of the post's first message, above our title. An empty line means the post has none.

**Which posts** (`POST_KEYS`, `lib/schema-discord.ts`):

- `shield`: the Raid Shield summary (D137, D147), posted by the tick. The line is read at each post and edit, so a line changed between Friday night and Saturday morning shows in the morning's edit; the message hash covers it.
- `thanks`: the weekly thanks posted to Discord (D114). The members' board's thank-you card does not take it: the card is a note in the officers' own words already.
- `garrison`: the garrison plan posted to Discord (D121), to either channel.
- **Notices take none.** A notice is the officers' own text from title to end, not a template of ours, and the issue's premise is "our templates stay ours". Officers can already put any line at the top of a notice, in each language. One standing line would sit on unrelated notices (a guide, an urgent change), and it would stay in one language above a notice that is written in three. The persona check agreed (below).
- The catalog posts of issue 713 part C add their own keys when they are built.

**Safety** (`lib/post-callout.ts`, pure).

- **Stored clean** (`cleanCallout`): line breaks, tabs and runs of spaces become one space; control characters, zero-width spaces, direction marks, overrides and isolates are removed (they could hide or flip the line); the zero-width joiner stays, since emoji are built with it; trimmed. The 120 is counted after this, at the route (400 `too_long`).
- **Posted literally** (`discordCallout`): D102's `escapeDiscord` (markdown, `>`, `[ ]`, `@everyone`, `@here`, user and role mentions `<@…>`), then what that leaves live in a line that opens a message: `#` and `-#` at its start (a heading or subtext), `://` (a web address: a zero-width space after the colon, so nothing is a link), `discord.gg/` and `discord.com/invite` (invites), and `<#` and `</` (channel and command mentions).
- Every message keeps `allowed_mentions: {"parse": []}` (D102), so even a mention that got through would ping no one.
- **No link at all** (adversarial review): a line repeated on every weekly post under the alliance's webhook is the easiest place to plant a phishing link. An alliance that wants a link puts it in a notice.
- **Where it never goes:** push notifications (D148), public pages, the members' board, AI or translation requests, a log line, `run_logs`, `app_errors` or an analytics property. The route's errors leave through `privately` as a code; the log carries nothing about it.

**Alliance settings → "Your line on our posts"** (`PostCallouts.tsx`, after Discord; EN, PT-BR, FR in `lib/private/dictionary.callouts.ts`).

- One field per post the alliance can get: "Raid Shield summary" (only while `shield_check` is on), "Weekly thanks", "Garrison post" (only while `garrison` is on). Each has its visible label, a line on where it goes ("Goes above the summary in the Raid Shield channel."), a 44 px field with 16 px text, "n of 120 characters" (in seal, "Too long: keep it to 120 characters.", with `aria-invalid`, past it), and "Preview of the next post": the line as typed, then our title in bold (the summary's in the language chosen for it), then "… the rest of the post". With no line: "No line yet: the post starts with its title."
- The lead: "Add one line of your own at the top of a post LAPTracker makes for you, such as “Let’s go, family!”. It is posted as you write it, never translated, and pings no one: @everyone, mentions and links do not work in it. It stays on every post until you change it, so keep it about the whole alliance."
- One Save for the card (the settings' save row, issue 585). It sends each changed post in turn and stops at the first refusal, keeping what was typed. The "On this page" index has a row "Your line on our posts · 1 of 3 set".
- `POST /api/w/[slug]/callouts {post, callout}`: officers only, same origin, JSON (401 `signed_out` for a member's or another workspace's session, D99); 403 `turned_off`; 400 `too_long`; at most 30 saves per 15 minutes per workspace (429 `rate_limited`, `auth_attempts` key `callout:ws:<id>`). It answers the cleaned line.

**The switch** (D134). `post_callouts` joins the catalog in the Discord group: "Your line on our posts" in Alliance settings, "Alliance's line on our posts" on /admin. It spends nothing, so it is allowed and on by default for every alliance. With it off (either layer) the card is hidden, the route answers 403, and every post goes out without a line; the saved lines stay and come back when it is on again.

**Storage** (migration `0071_workspace_post_touches`). `workspace_post_touches(workspace_id → workspaces on delete cascade, post_key in (shield, thanks, garrison), callout, updated_by → workspace_users on delete set null, updated_at)`, one row per workspace and post. A save of the text already stored writes nothing (`on conflict … where callout is distinct from excluded.callout`).

**Home's recent activity** (D108): "Ana changed the line on the Raid Shield summary" / "… on the weekly thanks" / "… on the garrison post" (PT "Ana mudou a frase do resumo do Escudo de raid", FR "Ana a changé la phrase du résumé du Bouclier de raid"), never the text. A same-text save adds no line. The table keeps one row per post, so only each post's latest change is a line.

**Download and delete** (D125). The table is in `WORKSPACE_TABLES` as `post-callouts.csv`: the line is the officers' own words, like Start here, so it is downloaded; it is deleted with the workspace.

**Analytics.** `ws_action` feature `post_callout`, action `save`, once per save that changed a line; no text and no post name (tracking plan, Changed 2026-11-22).

**Persona check** (a quick check by the build agent on the real card at 360 × 780, the e2e seed's invented alliance; three officers, an adversarial reviewer, a designer). Each got one question and the first screen:

- R5 in a hurry, "Where do I put our motto above the garrison post, and will it ping everyone?": found the "Garrison post" field and read "pings no one" in the lead. Right answer. On notices: "a notice is already mine, I'd forget a line is stuck on top of it." Notices stay out.
- Officer reading English as a second language, "What does this card do?": the example in the lead made it clear. "Callout" would not have been: the card and Home say "line" ("changed the line on the garrison post"), not the issue's "changed the … callout".
- Officer in her 50s, "If I type here, what will the post look like?": the preview under each field answered it (the line, then our title in bold). The muted lines are the desk's usual ink at 75 %.
- Adversarial (abuse, mentions, blame): pings and links are broken and `allowed_mentions` stays empty; hidden and direction characters are removed. Blame: a line repeats on every post until changed, and the thanks and garrison posts can go to the members' channel, so a line naming a member would shame them every week (D75). Adopted: the lead ends "It stays on every post until you change it, so keep it about the whole alliance." Home names who changed a line, never its text. Not adopted here: a history of every change (one row per post keeps only the latest change's officer), a follow-up.
- Designer: label, where-line, field, count and preview read top to bottom at 360 px with no overflow; 44 px field, 16 px text; one Save for the card as on the other cards. Accepted as built.

**Tests.** `lib/post-callout.test.ts`: nothing pings, links or makes a heading, for any input (fast-check), the 120 graphemes, the clean line. `lib/private/post-callouts.test.ts`: saved and read back, 120 kept and 121 refused, a change is one Home line without the text and a same-text save adds none, with the switch off nothing is saved, shown or posted and the line stays. `lib/private/thanks.test.ts`, `lib/private/garrison.test.ts`, `lib/shield-post.test.ts`: each post's first line is the escaped line, above the title, with `allowed_mentions` empty; the summary's edit leaves it out once the switch is off. `PostCallouts.test.ts`: the visible label, the count, the preview, the too-long state. The purge and download tests cover the new table. E2E `e2e/desk-callout.spec.ts`: an officer saves the garrison post's line, it survives a reload, the garrison plan posted to the leaders' channel opens with it (`@everyone` broken), and Home names the change without the text.

**Not done here.** The garrison page and the thanks sheet do not preview the line before posting; Alliance settings does. The catalog posts (part C) add their keys when built.
