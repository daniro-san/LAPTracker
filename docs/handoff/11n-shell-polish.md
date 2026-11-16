# 11n — Workspace shell polish: theme, help mark, officer name

Closes #334 (owner feedback after the first real sign-in on production, approved recommendations). Decision: D87 (new); D73 is unchanged from 11c.

## Built
- **Schema** (`lib/schema.ts`, migration `drizzle/0020_workspace_user_profile.sql`, journal idx 20, the next on `dev`): two nullable columns on `workspace_users`:
  - `chosen_name text`: the name the officer chose; null shows `display_name`;
  - `player_uid bigint`: "This is me"; null when not linked.
- **`lib/repo`**:
  - `findSession` also selects `chosen_name` and `player_uid`;
  - `updateWorkspaceUser(db, workspaceId, userId, { chosenName } | { playerUid })`: one row, only inside its own workspace;
  - `latestRosterNames(db, unionId)` (`workspace-rosters.ts`): uid and name of each member of the alliance's newest usable daily roster (the `member_uids` and `member_names` arrays; `raw_json` is not read).
- **`lib/private`**:
  - `access.ts`: `access.user.displayName` is `chosen_name ?? display_name`; `access.user.playerUid` is new.
  - `profile.ts`:
    - `cleanName`: trimmed, 1 to 32 characters, counted as code points;
    - `profileView`;
    - `renameOfficer` (`"invalid_name"`);
    - `linkPlayer`: only a uid in the newest roster of `access.unionId`, else `"not_in_alliance"`;
    - `unlinkPlayer`.
    - Suggestions: `matchName` (D74) on the shown name over that roster's current names. A `matched` result gives one player, `unsure` gives up to three, `none` gives an empty list.
    - While no player is linked, the profile also carries `roster`: that roster's uids and names, for the search. Once linked, it is empty.
  - `roster-search.ts`: `searchRoster(query, roster)` keeps the members whose name key (`nameKey`, D74) contains the query's key, in roster order, at most 6 (`SEARCH_ROWS`). It imports only `name-key`, so the sheet runs it in the browser.
- **Route** `app/(private)/api/w/[slug]/profile/route.ts`:
  - `GET` returns the profile;
  - `POST` takes `{action:"rename",name}`, `{action:"link",uid}` or `{action:"unlink"}`. It is a write: same origin, JSON only (403 otherwise), and the body is parsed with zod.
  - Every answer is the profile as it now stands, or a code. `private, no-store`. Nothing is logged.
- **Header** (`app/(private)/_ui/Frame.tsx`, two small edits in `SignedInFrame`):
  - "Signed in as <name>" is now a button, with the brand gear after the name as the tap cue. It opens `ProfileSheet` ("Your settings"), a modal `Sheet`:
    - **Your name**: a field with Save, and the note "Shown at the top of the desk (up to 32 characters)." The field has no `maxLength`: the server's code-point limit is the only rule, and a refusal shows "Write 1 to 32 characters.";
    - **This is me** (`app/(private)/_ui/ThisIsMe.tsx`, split from the sheet for its size):
      - "Is this you?" with a "That's me" button per suggestion;
      - when nothing matches, "We couldn't find a player with a name like yours. Search for your name below.";
      - while not linked, always a "Search the alliance" field. It filters the roster as the officer types, and each row has its own "That's me". A query with no hit shows "No one in the alliance has a name like that.";
      - under each candidate, its rank and might ("R4 · God of War · Might 52.8M"), so look-alike names can be told apart;
      - while not linked, "You can remove this link any time.";
      - once linked, "In the game, you are <name>." with "This isn't me", which removes the link.
      - Linking from the search goes through the same `linkPlayer`, so it has the same scoping and refusal;
    - **Theme**: Same as this device / Light / Dark;
    - **Close**.
  - The sheet opens focused on its title, so a phone does not raise the keyboard. The profile is read when the sheet opens, not on every page.
  - Sign out stays in the header. `SignOutButton.tsx` gained `min-w-11`: PT "Sair" was 39.75 px wide and is now 44 px (orchestrator's follow-up). It does not shrink or wrap, so FR "Se déconnecter" stays as it is.
  - The account line is one row: it no longer wraps, and it has `min-w-0`, so a long name truncates instead of pushing Sign out to a third row or the page sideways.
- **Theme** (`lib/brand/components/ThemeSwitch.tsx`): `setTheme(null)` removes `data-theme` and the `theme` cookie (follow the system); `useThemeChoice()` reads the choice. The desk writes the public site's `theme` cookie, and the root layout already renders `data-theme` from it on the server, so one choice applies to the desk and the public site with no flash.
- **Help mark**:
  - Drawn per the `hand-drawn-svg` skill: `icon_help` in `docs/brand/drawing/examples/ornaments.py`, registered as `icon-help` in `build.py`. It is a ring with a pen lift at the upper left, around a question mark and its dot: 16 × 16 viewBox, 908 bytes, single colour. `build.py` reproduces it byte for byte.
  - Component: `lib/brand/components/HelpMark.tsx`.
  - `FirstUse.tsx`: the bordered "?" square became the mark at 22 px in a 44 × 44 button. Its aria-label (`shell.help`) and its PostHog behaviour are unchanged.
- **Words**: 24 keys under `profile.*` in EN, PT-BR and FR, and card 1's new line `intro.1.settings` ("Tap your name at the top for your settings."). The profile words do not use "newest read". French has U+00A0 before `:` and `?`. The parity test passes.
- **First-use card 3 rewritten** (orchestrator's addition: the owner found it robotic):
  - `intro.3.body`, `intro.3.more` and `intro.3.last` have the new text in all three languages, and the titles are unchanged;
  - a new key `intro.3.note` holds the second sentence ("The app never messages anyone. The talking is up to you."), because each key renders as one paragraph. `lib/private/first-use.ts` lists it in step 3;
  - PT `intro.2.more` is now "— quer dizer sem dados, e não entra em nenhuma conta.";
  - the status label (Check in / Ver como está / Prendre des nouvelles) stays plain text, because the cards have no emphasis for it;
  - French uses U+00A0 before `:` and before the `?` that names the button, as the old line did.
- **Tests**:
  - `lib/private/discord.test.ts`: the nick fallback order;
  - `lib/private/profile.test.ts`: three tests:
    1. the validation;
    2. the header name, kept by the next sign-in;
    3. link and unlink between two workspaces. It also checks that the roster sent for the search holds OGs' players only, and that a candidate carries its rank (from `raw_json`) and might;
  - `lib/private/roster-search.test.ts`: the search folds case, accents and decoration, and returns at most 6 rows.

## Decisions
- **D87** (`docs/decisions/D87-officer-profile-display-name-and-player-link.md`, new; D73 stays as 11c wrote it):
  - the chosen name is kept apart from the Discord name;
  - `player_uid` is accepted only from the newest roster of the workspace's own alliance;
  - the theme reuses the `theme` cookie;
  - nothing about either is logged or sent to PostHog.
  - Its index line is after D79 in `docs/decisions/README.md`; D80–D86 are on other branches and fall between when they merge.
- **The theme lives in the settings sheet**, not next to EN · PT · FR. At 360 px the first header row already holds the title, the help mark and three 44 px language buttons. The sheet opens from the officer's name, which carries the gear.
- **The suggestion matches the shown name** (the chosen one when set, else the nickname). An officer whose Discord nickname is not their game name can type the game name and get a suggestion. The candidates are the newest roster's current names; name history is not used.
- **What "This is me" reads from the roster**: uid, name and might from the public arrays (`member_uids`, `member_names`, `member_power`), and only `rank_code` and `rank_label` from the same row's `raw_json` (`latestRoster` in `lib/repo/workspace-rosters.ts`). The rank uses the Members tab's `rankOf` (D56). No blocked roster field is read.

## Deviations
- **The nick fallback was already built.** 11c's `readMember` already took `nick`, then `global_name`, then `username`. This session only adds the test. The owner's header showed his username, so at that sign-in his account must have had no nickname in the OGs server and no global display name. This could not be checked against the real Discord: the e2e uses the stub only.
- **Migration number.** First built as `0022`, as the brief asked. On the orchestrator's follow-up, this branch merged `origin/dev` (56c534e, still at 0019, clean merge) and goes first, so the migration was regenerated as **`0020_workspace_user_profile`** (journal idx 20; its snapshot's `prevId` is 0019's id). `drizzle-kit check` and the drift gate pass. `db:local:migrate` applied 0020 to a local database at 0019.
  - **For 11f and 11i:** this branch takes 0020. Each regenerates its migration on top after this merges: drop your own migration file, its `meta/NNNN_snapshot.json` and its journal entry, merge `dev`, then run `pnpm db:generate --name <yours>`. It becomes 0021, then 0022, chained to 0020.
- **`lib/brand/components/ThemeSwitch.tsx` changed** (shared with the public site): `setTheme` accepts null, and a new hook was added. The public `ViewerSettings` is unchanged.
- **Changed after the review of PR #341:**
  1. The name field's `maxLength` and the `max`/`NAME_MAX` props are gone. `NAME_MAX` is private to `lib/private/profile.ts`.
  2. D73 is restored to 11c's text, and the profile's choices moved to the new D87.
  3. The account line no longer wraps (Header above). FR keeps "Se déconnecter"; "Quitter" was not needed.
  4. **The dark scrim.** A new token, `--sheet-scrim`, in `lib/brand/tokens.css`, used by the shared `Sheet`:
     - light: ink at 20 %, as before;
     - dark: black at 34 % (it was light ink at 20 %, which turned the header dusty pink).
     - The review asked for about 55 % and for header text at 4.5:1 or better. Both cannot hold: under black at 55 % the header text is 2.91:1. The strongest black scrim that keeps 4.5:1 is 35 % (4.51:1); 34 % gives 4.59:1, measured on the page.
  5. "This is me":
     - the new no-match and no-hit words;
     - the search always shown while not linked;
     - rank and might under each candidate;
     - the undo line;
     - "This isn't me".
  6. The gear moved after the name, and card 1 has the new settings line.
  7. Card 3 PT says "para ninguém", quotes «Ver como está», and says "O botão ? mostra…". Card 3 FR quotes « Prendre des nouvelles » with U+00A0 inside, and has the new note line.
  8. The name note is new. `RadioField` (shared) centres its radio on a one-line label; with a help line it keeps its old alignment. That centres the theme radios on the public settings panel too.

## Verified
- **`pnpm check` exits 0** after merging `dev`, the follow-ups and the PR #341 review changes: prettier, eslint, tsc; vitest **100 files passed, 2 skipped; 500 tests passed, 4 skipped**; drift gate "Everything's fine"; i18n "17 languages up to date". No test timed out. Before the merge it was 96 files and 483 tests.
- **Local e2e** against a production build (`pnpm build` + `next start` on :3147).
  - Setup:
    - db:local on 54357, with its bridge on 54358;
    - the Discord stub on 54397. Its member read returns `nick: "DucktorJones 🦆"`; a second account has no nick and `global_name` "Zed";
    - the seed: the OGs and NSE workspaces, OGs' newest roster with the 101 uids and names of the scrubbed fixture, and an NSE roster with one player;
    - playwright-core with system Chrome.
  - No upstream call, no real Discord call, no `/api/quota`.
  - **45 of 49 checks passed.** The 4 that failed were one existing problem: in PT, the header's "Sair" was 39.75 px wide. It is fixed in the follow-up, and the follow-up e2e below passes.
  - Passed:
    - the header shows "Signed in as DucktorJones 🦆"; `display_name` holds the nick;
    - the account without a nick shows "Zed";
    - the help button holds the drawn mark and no text, and is 44 × 44. It opens the "How this works" sheet; Replay starts at "1 of 3";
    - "This is me":
      - it suggests exactly DucktorJones (the emoji is ignored by `nameKey`);
      - "That's me" stores uid 340357857605, Remove the link clears it, and it links again;
      - the sheet opens with focus on its title;
    - the name:
      - an empty name gets "Write 1 to 32 characters.";
      - "  Ducktor  " is saved trimmed, and the header follows;
      - `chosen_name` is "Ducktor" while `display_name` stays the nick;
      - after Sign out and a new sign-in, the header still says "Ducktor" and the link stays;
    - the theme:
      - Dark sets `data-theme` and the `theme=dark` cookie;
      - the server HTML of `/w/ogs` and of `/` both carry `data-theme="dark"`, so there is no flash and one choice covers both;
      - Dark persists after a reload, and the sheet shows it checked;
      - "Same as this device" removes the attribute and the cookie;
    - the route:
      - linking NSE's player gets 400 `not_in_alliance`;
      - a POST with another Origin gets 403;
      - GET answers `private, no-store`;
      - the OGs session reading `/api/w/nse/profile` gets 401;
    - layout:
      - no sideways scroll at 360 and 1280, light and dark, EN and PT;
      - every header control is at least 44 px in EN.
  - The server log holds three `w.sign_in` codes and no name ("Duck" or "Zed" appear 0 times).
- **Card 3 e2e**, on a rebuilt production build after the card 3 change: **41 of 41 checks passed**.
  - Each case is a first sign-in that walks to card 3, at 360 px: EN light and dark, PT light and dark, FR light.
  - Every new phrase is present, French with its U+00A0.
  - Card 3 has four paragraphs, and none of the old words remain.
  - PT card 2 shows the new no-data line.
  - No sideways scroll.
- **Follow-up e2e**, on a production build after merging `dev` and applying 0020: **22 of 22 checks passed**.
  - Every header control is at least 44 px at 360 and 1280, light and dark, in EN, PT and FR. PT "Sair" is 44 × 44.
  - The search, as Zed (no nickname, no suggestion):
    - the sheet says "Search for your name below." (worded "We couldn't find a player with a name like yours. Search for your name below." since the review);
    - "LADYLI" finds LadyLi-rosan, and "vins" finds Vińs;
    - "nseonly" (NSE's player) shows the no-match line;
    - "e" shows 6 rows;
    - "Vińs · That's me" stores uid 341057265989;
    - the route still refuses NSE's player with 400 `not_in_alliance`;
    - the PT label "Procurar na aliança" finds Vińs.
- **Review e2e (PR #341, items 3–7)**, on a rebuilt production build. The seed's `raw_json` has `rank_code` and `rank_label` only. **36 of 36 checks passed**:
  - The header stays two rows with "DucktorJones 🦆" in EN, PT and FR at 360 px:
    - the name and Sign out share one row, and the account line is 49 px tall;
    - the name truncates;
    - no sideways scroll. The first run caught FR scrolling sideways by 29 px, which the account line's `min-w-0` fixed.
  - Sign out measured by its bounding box at 1x and 2x: EN 65.7 × 44, PT 44 × 44, FR 108.6 × 44.
  - The gear is after the name. Card 1 shows the settings line in EN and PT.
  - Dark, with the sheet open, in FR, PT and EN:
    - the backdrop is `rgba(0, 0, 0, 0.34)`;
    - the header text under it is 4.59:1, computed from the page's computed colours;
    - light is 6.49:1.
  - "This is me":
    - DucktorJones's candidate reads "R4 · God of War · Might 52.8M";
    - the search is shown next to a suggestion;
    - the undo line is shown;
    - linking shows "This isn't me", and tapping it unlinks;
    - Zed sees the new no-match words; "lady" finds "LadyLi-rosan · R5 · Might 49.9M"; a no-hit search shows the new words;
    - no "newest read" in the sheet.
- **Screenshots** (not committed) in `/private/tmp/claude-502/-Users-danilordasilva-orca-workspaces-LAPTracker-unicornfish/147759e3-1cdb-4ccd-b74a-1001498a1e18/scratchpad/11n-shots/`:
  - `home-{360,1280}-{light,dark}-{en,pt-BR}.png`;
  - `profile-{360,1280}-{light,dark}-{en,pt-BR}.png`, the sheet with the link in place;
  - `help-360-{light,dark}-{en,pt-BR}.png`;
  - `profile-suggest-360-light-en.png`, `profile-linked-360-{light,dark}-en.png`, `profile-none-360-light-en.png`;
  - `card3-360-{light,dark}-en.png`, `card3-360-{light,dark}-pt-BR.png`, `card3-360-light-fr.png`, `card2-360-light-pt-BR.png`;
  - `search-360-light-en.png`, `search-360-dark-pt-BR.png`, `signout-360-{light,dark}-pt-BR.png`;
  - after the review, in `v2/`:
    - `header-360-light-{en,pt,fr}.png`;
    - `sheet-open-360-dark-{fr,pt}.png`;
    - `card1-360-light-{en,pt}.png`;
    - `profile-candidates-360-light-en.png`.
- **Help mark drafts**: two kinds (a filled disc and a ring), then three rings, all on the burgundy header at 18–24 px in light and dark. The disc read heavier than the EN · PT · FR text, and the first rings' pen-lift end curled inward. The ring with its lift at the upper left was kept.

## Open issues
1. **A linked player who leaves the alliance** shows "Your player is no longer in the alliance." until the officer taps "This isn't me". Nothing unlinks by itself.
2. **The public settings panel** (`ViewerSettings`) offers Light and Dark only. "Same as this device" can only be chosen in the desk.
3. **`access.user.playerUid` is not used yet.** It is there for showing "you" on lists later.
4. **The modal sheet's backdrop lightens the header in dark mode** (`backdrop:bg-ink/20`, and ink is light in dark). This is the shared `Sheet` style, not changed here.
5. **Retention** of `chosen_name` and `player_uid` follows D71's open retention question.
6. **The search reads current names only.** Name history (#297) is not searched, so an officer who renamed in the game since the last daily read finds only the new name.

## Next
Session: the next workspace issue the orchestrator picks (#293–#321). The workspace track has no prompt in `docs/SESSION_PLAYBOOK.md`.
Model / effort: keep — no signal. The work fit one pass, plus one round of orchestrator follow-ups (card 3 words, the sign-out width, the search and the migration number).
Owner must do first: nothing. After the release, sign in once on production and check that the header shows the server nickname.
Plan changes needed: none.

<adjustments>
- Shown name: `access.user.displayName` is now `chosen_name ?? display_name`. Use it wherever the officer's name appears.
- "You" on lists: `access.user.playerUid` is the officer's uid in the workspace's own alliance, or null.
- Settings: the header's settings sheet is `app/(private)/_ui/ProfileSheet.tsx`. Words are under `profile.*`. A later officer setting goes there.
- Theme: `setTheme(null)` and `useThemeChoice()` are in `lib/brand/components/ThemeSwitch.tsx`.
- Roster names: `latestRosterNames(db, unionId)` in `lib/repo/workspace-rosters.ts` returns the newest roster's uids and names without touching `raw_json`.
- Help mark: `HelpMark` (`lib/brand/components/HelpMark.tsx`), drawn by `icon_help`.
- `dictionary.ts` is now 227 lines (300 allowed).
- Decision: the profile's choices are in D87; D73 is unchanged.
- First-use card 3 has four paragraphs: `intro.3.body`, `.more`, `.note` and `.last`.
- Name search: `searchRoster` (`lib/private/roster-search.ts`) is the browser-safe roster filter on name keys. Reuse it for any client-side name filter.
- Migration: this branch is `0020_workspace_user_profile`. A branch made before it regenerates its own migration on top (Deviations, "Migration number").
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/341
