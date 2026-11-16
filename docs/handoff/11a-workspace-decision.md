# 11a — Workspace decision (D71)

Base: `origin/dev` at f80bcd6 (release v5.6.0). Docs only; no code, no migration, no API call.

## Built
- `docs/decisions/D71-a-private-workspace-per-alliance.md` and its line in `docs/decisions/README.md` (after D67; D68–D70 belong to open branches).
- `CLAUDE.md`: one sentence added to the hard-rule bullet on roster fields. Code under `lib/private/` may return those fields, never `avatar_url`, to its own alliance's workspace (D71). Nothing else in the file changed.
- `docs/GLOSSARY.md`: row `workspace`, with `workspaces`, `lib/private`, `/w/[slug]`.
- This handoff.

## Decisions
- D71 is written from the owner's answers and the architect's design (2026-11-16). It covers: sign-in (Discord OAuth, scopes `identify guilds.members.read`, role check through `GET /users/@me/guilds/{guild_id}/member`, no bot, no new dependency); sessions (sha256 of a 32-byte token in `workspace_sessions`, 7 days); CSRF rules for writes; tenancy (`workspace_id NOT NULL`, branded `WorkspaceAccess`, a two-tenant PGlite test); the fence (`lib/private/`, an `import-x/no-restricted-paths` zone); other alliances (the owner registers a workspace on `/admin`; later an R5 proves ownership through the in-game declaration, issue #302); what the workspace shows; the languages (`en`, `pt-BR` and `fr` first; officer text machine-translated, original one tap away, an officer can correct it); leadership only, including the notices library; one level of access for R5 and R4 (no per-person permissions); regular members out of scope; what it supersedes; what new data is stored; where the data comes from (D72, issue #294).
- The decision says the same `1 + k` calls of the daily read (D60) read the rosters whole, so no call is added. It leaves the storage shape to D72.
- `BLOCKED_ROSTER_KEYS` is unchanged, as the task says. The code fence, not the key list, separates the workspace from public paths.
- Regular members' access is not designed in D71. Issue #301 (self-report link) is deferred until a later decision.
- The owner's "pt" is written as `pt-BR`, the tag in `LANGUAGES` (D48).
- The CLAUDE.md sentence names `avatar_url` as still never returned, because the task says the photo reaches pages only through `/img/avatar` (D22).

## Deviations
- None from the task. The task asked for D71 "about the length of D60 or D67"; D71 has 15 bullets, between the two.

## Verified
- `pnpm check` green after the last edit: prettier, eslint, tsc, vitest (277 passed, 1 skipped), drift, i18n (17 languages). Prettier left the glossary table widths unchanged.
- Checked against the files: D60 and D67 (format, daily read, `daily_rosters` has no `raw_json`), D22 (avatar rule), D3 (PIN), `lib/queries/blocked-keys.ts` (the nine keys and the non-recursive test), plan §12.1, §12.2, §12.6 (text quoted by D71).
- Not run: nothing here is runnable code, so no test covers D71's claims. The design file is the source for the Discord and tenancy details; none was re-checked against Discord's documentation.

## Open issues
1. **Retention.** D71 sets no retention rule for Discord ids, display names, officer-entered facts, participation records or the roster fields. Owner's decision.
2. **Plan §12.1** ("Data we store but never serve") needs a row: the blocked fields are served to the alliance's own workspace (D71). Not edited here.
3. **Plan §12.2** (secrets) needs a row for `DISCORD_CLIENT_SECRET`, the session cookie and the `workspace_sessions` hashes. Not edited here.
4. **Plan §12.6** ("No user accounts, no OAuth") is superseded for the workspace only (D71) and needs a pointer to D71. Not edited here.
5. **Translation service.** D71 leaves it open; it is decided with the screenshot import (#299, an external processor through the AI Gateway). Whatever is chosen receives officer-written text, so it falls under the retention and privacy question in 1.
6. **Regular members.** Any page, link or form for non-leadership members needs its own decision. #301 waits for it; #296 to #300 are leadership-only work.
7. **Plan §12.1 also says** the player pages follow the same list. That stays true for public pages; a workspace player view is a later session's design.

## Next
Session: none queued in `docs/SESSION_PLAYBOOK.md`. The next work is issue #294 (end-of-day daily read, D72), then issue #295 (Discord sign-in).
Model / effort: keep for #294: it changes one existing function, `lib/daily-read.ts`, and its window. Raise one for #295: it adds an OAuth flow, sessions and a tenancy fence, and an error there leaks private data.
Owner must do first: create the Discord application (client id and secret, redirect URI for the app's origin) and put `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET` in Vercel; send the OGs Discord server id and the leadership role ids. #294 needs none of this. Also decide retention (Open issues 1). Before #299, decide the translation service with it.
Plan changes needed: §12.1, §12.2 and §12.6 (Open issues 2 to 4). Do not edit the plan from this session.

<adjustments>
- #294 moves the daily read to the end of the server day. D60's `DAILY_ROSTER_AT` default is `06:00` server time and its window is `[DAILY_ROSTER_AT, + SNAPSHOT_WINDOW_MIN)`; the "not on a scheduled event's day" rule and D67's retry rule (today's server day only) were written for a morning read, so check both against the new time.
- `daily_rosters` stores four parallel arrays and no `raw_json` (D60). The workspace fields (`daily_tech`, `daily_honor`, `active`, `joined_at`, `online`, `last_online_at`, `x`, `y`) need a place in D72; they must not go into any table that `lib/queries` reads.
- The workspace is not English-only (D71). Its strings go through the public dictionaries (D48), so `pnpm check`'s i18n step and the `translate-copy` skill apply to them; `en`, `pt-BR` and `fr` are required first. Translating officer-written text and its correction by an officer need a table and a service that #295 and #299 do not yet design.
- Skip #301 (member self-report link): deferred by the owner. Build no member-facing page, link or token in #295 to #300; every workspace route requires a leadership sign-in, and all leaders see all of it, so no per-person permission model is needed.
- Private code goes in top-level `lib/private/`, not `lib/queries/private/`: `lib/queries/blocked-keys.test.ts` scans `lib/queries` non-recursively.
- No new dependency for sign-in: two `fetch` calls, `node:crypto` and `secretEquals` (`lib/auth.ts`).
- Decision numbers D68, D69 and D70 belong to open branches 08zzzx, 08zzzza and 08zzzzb; D72 is the end-of-day read.
</adjustments>

PR: (added by the orchestrator)
