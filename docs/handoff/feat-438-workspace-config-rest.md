# feat-438-workspace-config-rest

## Built
- Alliance settings → Language card: officers pick English, Portuguese, French or "follow each person's browser" for their workspace. `POST /api/w/[slug]/desk-language`, `requireWorkspace`, 60 saves per 15 minutes.
- `workspaces.default_language` (migration 0096). `pickWorkspaceLanguage` takes the workspace default as a third argument (cookie, then default, then Accept-Language). `workspaceWords(slug)` reads it for desk pages under `/w/[slug]`, only for a viewer with no language cookie.
- Copy in EN, PT-BR and FR (`lib/private/dictionary.branding.ts`, keys `deskLang.*`).
- D168.

## Decisions
- Checked against code on origin/dev, already done: own key (#442, D124), delete (#449, D125), any alliance (#508, D133), sealed per-workspace webhooks, branding (#889, D167).
- Glossary is per workspace: `lib/repo/glossary.ts` keys `workspace_glossary` by workspace id (#846). Nothing to build.
- Bot install link: `installUrl(env, workspace.discordGuildId)` in `lib/private/discord-setup.ts`, with `guild_id` and `disable_guild_select`. Nothing to build.
- Posts already had a language per workspace (`post-settings.ts`, D159). The desk followed only the viewer's cookie or browser: that was the gap.

## Deviations
- API routes under `/api/w/[slug]/*` still pick their error-message language from the cookie or the browser only. They carry error words only.
- No row in the settings "On this page" index for the new card.

## Verified
- `pnpm vitest related --run` on the changed files: 122 files, 708 tests passed.
- `pnpm check`: passed (prettier, eslint, tsc, vitest, drift, i18n).
- Tests added: route test (officer saves and clears, bad language refused, member and other workspace's officer refused), one `pickWorkspaceLanguage` test, one fixture line in `member-session.test.ts`.

## Open issues
- Issue 438's items 1 to 7 are now all done in code. The owner guide and the guest guide (item 7) were not updated here.
- Discord messages follow the Discord user's locale, not the workspace default. Not asked in the issue.

## Next
- Add the Language card to the owner guide and guest guide when guides are next refreshed.
- Optionally add an index row and make API error words follow the default.
- Close #438 once the PR is merged.

What was missing from the task prompt? Nothing; the three candidate items were enough to scope the work.

PR: (added by the orchestrator)
