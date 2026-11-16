# 11n — Workspace shell polish: theme, help mark, officer name

Closes #334 (owner feedback after the first real sign-in on production, approved recommendations). Decision: D73 amended with one dated line; no new decision.

## Built
- **Schema** (`lib/schema.ts`, migration `drizzle/0022_workspace_user_profile.sql`, journal idx 22): two nullable columns on `workspace_users`:
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
- **Route** `app/(private)/api/w/[slug]/profile/route.ts`:
  - `GET` returns the profile;
  - `POST` takes `{action:"rename",name}`, `{action:"link",uid}` or `{action:"unlink"}`. It is a write: same origin, JSON only (403 otherwise), and the body is parsed with zod.
  - Every answer is the profile as it now stands, or a code. `private, no-store`. Nothing is logged.
- **Header** (`app/(private)/_ui/Frame.tsx`, two small edits in `SignedInFrame`):
  - "Signed in as <name>" is now a button with the brand gear. It opens `ProfileSheet` ("Your settings"), a modal `Sheet`:
    - **Your name**: a field with Save; the note "Saved." or "Write 1 to 32 characters.";
    - **This is me**: "Is this you?" with a "That's me" button per suggestion. Once linked: "In the game, you are <name>." with "Remove the link". When nothing matches, a line says to set the name to the game name;
    - **Theme**: Same as this device / Light / Dark;
    - **Close**.
  - The sheet opens focused on its title, so a phone does not raise the keyboard. The profile is read when the sheet opens, not on every page.
  - Sign out stays in the header, unchanged.
- **Theme** (`lib/brand/components/ThemeSwitch.tsx`): `setTheme(null)` removes `data-theme` and the `theme` cookie (follow the system); `useThemeChoice()` reads the choice. The desk writes the public site's `theme` cookie, and the root layout already renders `data-theme` from it on the server, so one choice applies to the desk and the public site with no flash.
- **Help mark**:
  - Drawn per the `hand-drawn-svg` skill: `icon_help` in `docs/brand/drawing/examples/ornaments.py`, registered as `icon-help` in `build.py`. It is a ring with a pen lift at the upper left, around a question mark and its dot: 16 × 16 viewBox, 908 bytes, single colour. `build.py` reproduces it byte for byte.
  - Component: `lib/brand/components/HelpMark.tsx`.
  - `FirstUse.tsx`: the bordered "?" square became the mark at 22 px in a 44 × 44 button. Its aria-label (`shell.help`) and its PostHog behaviour are unchanged.
- **Words**: 21 keys under `profile.*` in EN, PT-BR and FR. French has U+00A0 before `:` and `?`. The parity test passes.
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
    3. link and unlink between two workspaces.

## Decisions
- **D73 amended** (dated line), not a new number:
  - the chosen name is kept apart from the Discord name;
  - `player_uid` is accepted only from the newest roster of the workspace's own alliance;
  - nothing about either is logged or sent to PostHog;
  - the theme reuses the `theme` cookie.
- **The theme lives in the settings sheet**, not next to EN · PT · FR. At 360 px the first header row already holds the title, the help mark and three 44 px language buttons. The sheet opens from the officer's name, which carries the gear.
- **The suggestion matches the shown name** (the chosen one when set, else the nickname). An officer whose Discord nickname is not their game name can type the game name and get a suggestion. The candidates are the newest roster's current names; name history is not used.
- **The roster read is the public arrays** (`member_uids`, `member_names`), not `raw_json`, so no blocked roster field is touched.

## Deviations
- **The nick fallback was already built.** 11c's `readMember` already took `nick`, then `global_name`, then `username`. This session only adds the test. The owner's header showed his username, so at that sign-in his account must have had no nickname in the OGs server and no global display name. This could not be checked against the real Discord: the e2e uses the stub only.
- **Migration number.** Built as `0022` with journal `idx: 22` (this branch has no 0020 or 0021), as the brief asked. `drizzle-kit check` and the drift gate pass, and `db:local:migrate` applied it.
- **`lib/brand/components/ThemeSwitch.tsx` changed** (shared with the public site): `setTheme` accepts null, and a new hook was added. The public `ViewerSettings` is unchanged.

## Verified
- **`pnpm check` exits 0**: prettier, eslint, tsc; vitest **96 files passed, 2 skipped; 483 tests passed, 4 skipped**; drift gate "Everything's fine"; i18n "17 languages up to date". No test timed out.
- **Local e2e** against a production build (`pnpm build` + `next start` on :3147).
  - Setup:
    - db:local on 54357, with its bridge on 54358;
    - the Discord stub on 54397. Its member read returns `nick: "DucktorJones 🦆"`; a second account has no nick and `global_name` "Zed";
    - the seed: the OGs and NSE workspaces, OGs' newest roster with the 101 uids and names of the scrubbed fixture, and an NSE roster with one player;
    - playwright-core with system Chrome.
  - No upstream call, no real Discord call, no `/api/quota`.
  - **45 of 49 checks passed.** The 4 that failed are one existing problem: in PT, the header's "Sair" is 39.75 px wide (Open issues 1).
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
- **Screenshots** (not committed) in `/private/tmp/claude-502/-Users-danilordasilva-orca-workspaces-LAPTracker-unicornfish/147759e3-1cdb-4ccd-b74a-1001498a1e18/scratchpad/11n-shots/`:
  - `home-{360,1280}-{light,dark}-{en,pt-BR}.png`;
  - `profile-{360,1280}-{light,dark}-{en,pt-BR}.png`, the sheet with the link in place;
  - `help-360-{light,dark}-{en,pt-BR}.png`;
  - `profile-suggest-360-light-en.png`, `profile-linked-360-{light,dark}-en.png`, `profile-none-360-light-en.png`;
  - `card3-360-{light,dark}-en.png`, `card3-360-{light,dark}-pt-BR.png`, `card3-360-light-fr.png`, `card2-360-light-pt-BR.png`.
- **Help mark drafts**: two kinds (a filled disc and a ring), then three rings, all on the burgundy header at 18–24 px in light and dark. The disc read heavier than the EN · PT · FR text, and the first rings' pen-lift end curled inward. The ring with its lift at the upper left was kept.

## Open issues
1. **PT "Sair" is 39.75 px wide** (an existing problem, not changed here): `SignOutButton.tsx` has `min-h-11` but no `min-w-11`. One class fixes it.
2. **No way to pick a player when the matcher finds none**, other than setting the name to the game name. A roster search in the sheet was not built.
3. **A linked player who leaves the alliance** shows "Your player is not in the alliance's newest read" until the officer removes the link. Nothing unlinks by itself.
4. **The public settings panel** (`ViewerSettings`) offers Light and Dark only. "Same as this device" can only be chosen in the desk.
5. **`access.user.playerUid` is not used yet.** It is there for showing "you" on lists later.
6. **The modal sheet's backdrop lightens the header in dark mode** (`backdrop:bg-ink/20`, and ink is light in dark). This is the shared `Sheet` style, not changed here.
7. **Retention** of `chosen_name` and `player_uid` follows D71's open retention question.
8. **Merge order.** If 11f (0020) and 11i (0021) merge first, regenerate this migration on top: drop `0022_workspace_user_profile.sql`, `meta/0022_snapshot.json` and its journal entry, then run `pnpm db:generate --name workspace_user_profile`. The snapshot's `prevId` must chain to 0021.

## Next
Session: the next workspace issue the orchestrator picks (#293–#321). The workspace track has no prompt in `docs/SESSION_PLAYBOOK.md`.
Model / effort: keep — no signal. The work fit one pass; the only surprise was the PT sign-out width, which was there before this session.
Owner must do first: nothing. After the release, sign in once on production and check that the header shows the server nickname.
Plan changes needed: none.

<adjustments>
- Shown name: `access.user.displayName` is now `chosen_name ?? display_name`. Use it wherever the officer's name appears.
- "You" on lists: `access.user.playerUid` is the officer's uid in the workspace's own alliance, or null.
- Settings: the header's settings sheet is `app/(private)/_ui/ProfileSheet.tsx`. Words are under `profile.*`. A later officer setting goes there.
- Theme: `setTheme(null)` and `useThemeChoice()` are in `lib/brand/components/ThemeSwitch.tsx`.
- Roster names: `latestRosterNames(db, unionId)` in `lib/repo/workspace-rosters.ts` returns the newest roster's uids and names without touching `raw_json`.
- Help mark: `HelpMark` (`lib/brand/components/HelpMark.tsx`), drawn by `icon_help`.
- `dictionary.ts` is now 223 lines (300 allowed).
- First-use card 3 has four paragraphs: `intro.3.body`, `.more`, `.note` and `.last`.
- Migration: this branch adds `0022_workspace_user_profile` (Open issues 8).
- Before a new header control: PT "Sair" is under 44 px wide (Open issues 1).
</adjustments>

PR: (added by the orchestrator)
