# 11v — Notices: copy per place, Publish to Discord, earlier versions, calendar link

Issue #345 (follow-up of #304 and #344). Branch `session/11v-notices-publish` from `origin/dev` (2afa453). Decision D102. Rules applied: D71, D75, D81, D99, D100, issue 293's field versions. Items built in the order asked: 1–4 built, 5 (images) not built (see Deviations).

## Built
- **Copy formats** (`lib/private/notice-formats.ts`, pure, browser-safe). Each language on the read page has three buttons:
  - "Copy for game notice": plain text, `\n` line breaks, no spaces at line ends, no blank lines at either end. Over 1,000 characters it is cut after the last whole line that fits; the button then says "Copied the first 1000 characters".
  - "Copy for game mail": the same plain text, never cut.
  - "Copy for Discord": the title in bold, a blank line, then the text. Discord markdown in the text is escaped (web addresses are left alone), and `@everyone`, `@here` and `<@` are broken with a zero-width space.
  - Each button shows "Copied" for 2.5 s (the existing `CopyButton`). The old single "Copy {lang}" key is gone; no decision quoted it.
- **Publish to Discord** (`lib/private/notice-publish.ts`, `app/(private)/api/w/[slug]/notices/publish/route.ts`, `app/(private)/_ui/NoticePublish.tsx`):
  - The channel follows the notice's audience. With "Show to members" on it goes to the workspace's `members` channel, otherwise to its `leaders` channel. Both come from `WORKSPACE_DISCORD_WEBHOOKS` (JSON by slug, validated in `lib/env.ts`; each channel has `url`, `name` and `forum`).
  - The URLs are on the redaction list (`secretsOf`). They are never stored in the database or the repo.
  - A "Discord" section under the languages says where this notice goes ("A notice for members goes to #guides-and-beyond."). Without a channel, the button is disabled and the line says "No Discord channel is set up for … notices yet. Ask the site owner."
  - The sheet is titled "Post to #guides-and-beyond?" and lists the written languages, all ticked. Post sends them.
  - Every message has `allowed_mentions: {"parse": []}`, so a post never pings anyone.
  - Message layout: with several languages, each sits under its bold name. A forum channel gets a new post named after the notice, and any further messages go inside that post. A plain channel gets the title in bold at the top. Messages are at most 2,000 characters each.
  - Duplicates: the sheet makes one request id when it opens (D100). The route claims a `notice_publishes` row before it posts anything. A repeat gets the first outcome: 200 if posted, 409 `posting` while it runs, 502 `failed`.
  - Record and display: the row keeps who, when, the audience, the languages, the status and how many messages Discord took. The page shows "Posted to #guides-and-beyond by Rook (R4) · … · EN, PT".
  - Logs carry codes and numbers only: `notices.publish.ok` and `notices.publish.failed`.
  - The route answers `401 signed_out` like batch B (D99).
- **Earlier versions** (`lib/private/notice-history.ts`, `app/(private)/_ui/NoticeHistory.tsx`, `notice-draft.ts` `withRestored`):
  - In the editor, under the end date, there is a folded "Earlier versions (n) ▾". It lists one line per save (who · when · fields changed), newest first, and the first one says "Current version".
  - Opening a save shows "Before" and "Saved" for each field. A field with no earlier text says "First text"; a "Keep as is" save says "Same text, marked up to date".
  - "Restore this version" puts every field back as it stood after that save. Each changed language becomes a draft with Accept and Undo ("Draft from an earlier version, not saved"). A line says "Earlier version restored as a draft. Check it, then press Save."
  - Save writes a new save. Old rows are never changed.
- **Calendar link** (`calendar_entries.notice_id`, `app/(private)/_ui/notice-calendar.ts`, `NoticeCalendarLink.tsx`, `EntryForm.tsx` "Notice (optional)"):
  - Either side can link a notice to an entry, and both sides show the link. The Calendar agenda shows "Notice: <title>". The notice page has a "Calendar" section that lists the linked entries with their next date in ST and a "Remove link" button. Its "Link a calendar entry" sheet lists the entries of this week and the next four.
  - Both sides write the entry's new `notice` field through the Calendar route, with its version.
  - The server refuses a notice from another workspace with 400.
- **Migration** `drizzle/0027_notice_publishes_and_calendar_link.sql`: the table `notice_publishes`, plus `calendar_entries.notice_id` (`on delete set null`).
- **Words**: 41 new notices keys in `lib/private/dictionary.notices-more.ts`. They sit in a separate file because `dictionary.notices.ts` would pass 300 lines; that file spreads them in. 5 calendar keys were also added. All keys exist in EN, PT-BR and FR, and French uses U+00A0 before `:` and `?`.
- **Tests**:
  - `lib/private/notice-formats.test.ts` (3 tests): the cut, mail and Discord escaping, and message splitting.
  - `app/(private)/api/w/[slug]/notices/publish/route.test.ts` (4 tests): members and leaders channels, posts once per request id, no mentions, the forum post with `thread_id`, and not set up.
  - The calendar test helper and draft fixture gained `notice: null`.
- **Docs**: D102, the decisions index, `docs/ARCHITECTURE.md` (the new lib/private modules) and `.env.example` (the variable name only).

## Decisions
- **Where the channels live.** One env var holds JSON by slug, as the task said. The display name and `forum` are fields next to the URL. The owner's rule "chosen per workspace in its settings, never guessed from the channel name" is met by configuration per slug; there is no settings screen.
- **The `forum` flag.** The owner described `#notices` as a forum channel. Discord rejects a webhook post to a forum without `thread_name`, and refuses `thread_name` on a plain channel. So each channel says which kind it is. The default is `false`.
- **The game copies carry no title.** 11i found that the game's board and mail have their own title field. The Discord copy includes the title, as the owner asked ("title plus body").
- **The game notice is cut, the mail is not.** The task names the board's 1,000-character limit. The mail's limit is unknown, so cutting it would lose text for no known reason.
- **The publish route does not use `lib/discord-send.ts`.** lib/private is fenced from `lib/discord-*` (D71, eslint). It posts with `AppContext.fetch`, as the D96 reply does. D102 records this exception to D71's "sends no Discord message".
- **Only posted publishes are shown** on the page. Failed ones stay in the table for the record.
- **The read page keeps stacked languages.** The task said "for each language tab". The editor has tabs; the read page shows each language in its own section, and each section got the three copies. I did not convert the read page to tabs.
- **History is the newest 300 edit rows.** The page says so when there are more. Restoring a version older than that window only restores the fields the window holds.
- **Designer-persona critique** (a mobile product designer, from the 360/390/1280 shots):
  1. Fixed: the "Posted to Discord …" line did not say which channel. After a notice changed audience, it read as if the last post had gone to the channel named just above it. It now names the channel ("Posted to #notices by …").
  2. Fixed: the history rows looked like plain text. Each folded row and the list header now end in "▾".
  3. Kept: three copy buttons per language wrap to two lines at 360. Each is 44 px tall, and the labels say exactly where the text goes.
  4. Kept: "Copied" replaces the button's label for 2.5 s. The cut case gets its own words, so the officer knows the end was dropped.
  5. Left: the Discord, Calendar and history sections all sit below the languages, so a long notice pushes them far down on a phone. Moving them up would hide the text, which is what the page is for.

## Deviations
- **Images not built.** No storage exists: D02 keeps Postgres for rows and rules out Blob, and no storage variable (`BLOB_READ_WRITE_TOKEN` or another) is set. The task said not to add a new paid service. The publish therefore sends text only.
- **D101 does not exist on this branch.** Another session holds that number, so the index goes from D100 to D102.

## Verified
- **`pnpm check` exit 0**: prettier, eslint, tsc, vitest (151 files: 149 passed, 2 skipped; 786 tests: 782 passed, 4 skipped), the drift check ("Everything's fine") and i18n (17 languages up to date).
- **Local e2e, Chrome**, on a production build (`next build`, then `next start` on :3857):
  - Setup: local Postgres 18 on 55837 with all 28 migrations, the bridge on 55838, and the Discord sign-in stub on 55839 (invented officers Rook and Wren).
  - Webhook stub on 55840. A Node preload (`webhook-preload.mjs`) routes `https://discord.com/api/webhooks/*` to it. The stub answers like Discord (`{id, channel_id}`; a forum post's first message opens a thread), waits 400 ms per message, and returns 500 for text containing `ZZFAIL`.
  - The env var held invented discord.com URLs (members: forum, `guides-and-beyond`; leaders: plain, `notices`).
  - Harness `scratchpad/11v/e2e.mjs`: **89 of 89 passed**, among them:
    - copies: the game notice cut at 991 characters after a whole line, with "Copied the first 1000 characters"; the mail is the full text; the Discord copy has the bold title, the escaped `\|`, `\_` and `\*`, `@​everyone` broken, and the URL untouched; a short text is not cut;
    - publish: "A notice for members goes to #guides-and-beyond."; the sheet "Post to #guides-and-beyond?" with EN and PT ticked; Post tapped twice gives one `notice_publishes` row; only the members channel was posted to; `thread_name` is the title; every message has `allowed_mentions {"parse":[]}` and is at most 2,000 characters; the page line "Posted to #guides-and-beyond by … · EN, PT";
    - the same request id sent twice at once and then a third time straight to the route: one post (statuses 200, 409 `posting`, 200);
    - the notice switched to leadership: "A leadership notice goes to #notices."; PT only gives one plain message `**Garden rota**\n\n<PT>` to the leaders channel;
    - a refused post: the sheet stays open with "Discord did not take the whole notice…", and the row is `failed`;
    - history: three saves, newest first, "Current version", Before/Saved; Restore of the first save gives EN a draft with the earlier text and turns "Show to members" back on; Accept and Save write a fourth save, and the read page shows the restored text;
    - calendar: an entry made through the calendar route; "Link a calendar entry" from the notice; the entry shows "Tue, Nov 17 · 23:00 ST"; its link opens the Calendar week with "Notice: Garden rota"; the entry sheet has the notice chosen; "No notice" unlinks it and choosing the notice links it again from the calendar side; "Remove link" on the notice page sets `notice_id` to null;
    - 360 and 1280, light and dark, EN and PT: no sideways scroll and every target 44 px or more, on the read page, the publish sheet, the calendar sheet, and the editor with history open.
- **WebKit, iPhone 14 context** (390 × 844, isMobile, hasTouch, DPR 3, the iPhone UA, cached WebKit 2388), light and dark. Pages: read page, publish sheet, calendar sheet, editor with history, the calendar entry sheet with "Notice (optional)". **30 of 30 passed**: no sideways scroll, fields at 16 px, no target under 44 px.
- **No real Discord, Groq or upstream call.** The upstream URL was a dead local port and there was no Groq key.
- **Privacy**: all names and texts are invented (Rook, Wren, "Garden rota", "Seed swap"). The diff and the e2e were grepped against the 128 member and alliance names in the OGs fixtures: no match.
- **Screenshots** (not committed) are in `/private/tmp/claude-502/-Users-danilordasilva-orca-workspaces-LAPTracker-unicornfish/147759e3-1cdb-4ccd-b74a-1001498a1e18/scratchpad/11v-shots/`:
  - `a*`, `b*`: the notice and its copies;
  - `c*`: the publish sheet and the posted line;
  - `d0`: the failed post;
  - `e*`: history and restore;
  - `f*`: the calendar link from both sides;
  - `g-{read,publish,pick,history}-{360,1280}-{light,dark}-{en,pt}`;
  - `w-*`: WebKit 390.

## Open issues
1. **Images** wait for a storage decision: Postgres `bytea` with a size cap, or Vercel Blob (a new dependency). With images, the publish could attach the poster as D58 does.
2. **A partial publish is not resumed.** If Discord takes message 1 and refuses message 2, posting again posts message 1 a second time. The sheet tells the officer to check the channel first.
3. **The Discord copy is one block.** A language over 2,000 characters after escaping cannot be pasted as one message (Discord's limit without Nitro). Publish splits it; the copy does not.
4. **The calendar's "Notice" choice is a native `<select>` of up to 200 titles.** It is fine for the OGs' numbers today; a long library would want search.
5. **A 409 on the link from the notice page** (someone changed the entry's link first) shows the generic "Could not change the link. Try again." and reloads, rather than the Calendar's conflict box.

## Owner guide: setting up "Publish to Discord"
1. In Discord, for each of the two channels (`#guides-and-beyond` for members, `#notices` for R4/R5), open Edit Channel → Integrations → Webhooks → New Webhook, and copy its URL. Do not paste it anywhere else.
2. In Vercel, project `laptracker` → Settings → Environment Variables, add `WORKSPACE_DISCORD_WEBHOOKS` (Production, and Preview if wanted). Mark it Sensitive. Its value is one line:
   `{"ogs":{"members":{"url":"<members webhook URL>","name":"guides-and-beyond","forum":true},"leaders":{"url":"<notices webhook URL>","name":"notices","forum":true}}}`
   Set `"forum": true` for a forum channel and `false` for a plain text channel. The `name` is only what the confirm question shows, without `#`.
3. Redeploy. A typo in the JSON stops the app from starting, and the build log names the field, never the URL. Open a notice: the Discord section should name the channel.
4. To stop publishing to one audience, remove its entry from the JSON and redeploy.

## Next
Session: the next workspace issue the orchestrator picks. The workspace track has no prompt in `docs/SESSION_PLAYBOOK.md`.
Model / effort: keep. Items 1–4 fit one pass. The time went to the e2e harness, where my long test text was first under 1,000 characters.
Owner must do first: create the two webhooks and `WORKSPACE_DISCORD_WEBHOOKS` (guide above). Then post one test notice to each channel, and say whether the forum post looks right (title as post name, languages in bold).
Plan changes needed: none. The workspace track lives in issues, not in docs/IMPLEMENTATION_PLAN.md.

<adjustments>
- Posting to Discord from the workspace: use `AppContext.fetch` from lib/private (the eslint fence keeps `lib/discord-*` out). Claim a row under the sheet's request id first, then set `allowed_mentions: {"parse": []}`. `lib/private/notice-publish.ts` is the pattern.
- `WORKSPACE_DISCORD_WEBHOOKS` already has per-slug channels with `name` and `forum`. A later "post the calendar week" or similar can add a key per channel rather than a new variable.
- Stubbing Discord webhooks with no code change: `NODE_OPTIONS="--import ./scripts/db-local-preload.mjs --import <webhook-preload.mjs>" next start`, with invented `https://discord.com/api/webhooks/…` URLs in the env. Copies are in `scratchpad/11v/` (`webhook-preload.mjs`, `webhook-stub.mjs`, `make-env.mjs`).
- Images on notices (#345's remaining item) need the storage decision first. The publish code has one place to add an attachment (`post` in `notice-publish.ts`).
- Calendar entries now carry `notice_id`. A members' board (#331) can show an entry's notice next to it.
</adjustments>
