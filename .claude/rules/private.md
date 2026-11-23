---
paths:
  - "lib/private/**"
  - "app/?private?/**"
  - "lib/repo/me.ts"
  - "lib/repo/workspace-rosters.ts"
  - "lib/push-tick.ts"
  - "lib/posts-tick.ts"
---

# Private workspace: roster fields

The CLAUDE.md roster-fields rule is binding; this is its checklist. `app/?private?/**` is `app/(private)/**` written so every glob matcher reads the parentheses literally. Sources: D22, D71, D76, D142, D143, D148. The list itself is `BLOCKED_ROSTER_KEYS` in `lib/queries/blocked-keys.ts`.

## The fields

| Field                                 | Desk (officers, `requireWorkspace`, own alliance)                 | Member's own page `/w/[slug]/board/me` (D142) | Public pages, `/admin`                                                                        |
| ------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `daily_tech`, `daily_honor`, `active` | yes                                                               | yes, own uid only                             | D76 only: alliance aggregates on public pages, per member on `/admin`, `OWN_ALLIANCE_ID` only |
| `joined_at`                           | yes                                                               | no                                            | no                                                                                            |
| `x`, `y`, `online`, `last_online_at`  | yes, but never in copies or exports                               | no                                            | no                                                                                            |
| `avatar_url`                          | never returned; the photo is the image `/img/avatar/[uid]` serves | never                                         | never                                                                                         |
| badges (`badge_id` 101–110)           | only as `/img/badge/[id]`                                         | same                                          | same                                                                                          |

## Where they may go

- [ ] Served only through `lib/private` (`lib/repo/me.ts` and `lib/repo/workspace-rosters.ts` read them from `raw_json` for it), and only to pages and handlers under `app/(private)/w/[slug]` and `app/(private)/api/w/[slug]`, after `requireWorkspace`, for rows of that workspace's own alliance.
- [ ] The one member exception (D142): the member's own `daily_tech`, `daily_honor` and `active`, only on `/w/[slug]/board/me`, behind `requireBoard` and an officer-approved player link, for that link's uid, in the page's HTML rendered per request with `Cache-Control: private, no-store`. Only that page renders them (through `meView`); any other place a member could see them needs a decision first.
- [ ] `lib/push-tick.ts` takes counts only from `lib/private/push-roll-calls.ts`, never a field or a name (D148).
- [ ] `lib/posts-tick.ts` calls only `lib/private/catalog-posts.ts`, whose posts carry the calendar entries members can see and never a field of this table (D159). The one person it names: the welcome post (D159 amendment 2026-11-23, post 3) names new members by their public name (`member_names`, never `raw_json`), nothing else about them.

## Where they must never go

- [ ] Logs, `run_logs`. `app_errors.detail` may keep an error's own message only after the private-field redactor (`redactPrivate`, `lib/redact.ts`), for the owner's `/admin/errors` only; rows are purged after 30 days (D115, 2026-11-21). `feedback.text` and its one picture (`feedback_pictures`) may keep what a sender typed or showed, the text only after `redactPrivate`, for the owner's `/admin/feedback` only (the picture through the PIN-gated `/admin/feedback/picture/[id]`); rows and pictures are purged after 180 days and never go to logs, analytics, AI or Discord (D157, owner, 2026-11-22).
- [ ] Discord messages.
- [ ] AI or translation requests.
- [ ] Any shared cache (D143 caches hold public reads only).
- [ ] Copies and exports: leave out `x`, `y`, `online` and `last_online_at`.
- [ ] Analytics events and properties (PostHog), which also carry no member names.
- [ ] Session replay: `/w` and `/admin` text is masked by the layout's `ph-mask`; per-member values such as bars also need `ph-no-capture`.
- [ ] Fixtures: `x`, `y`, `online`, `last_online_at` and `joined_at` stay neutralised (D76); names are invented.

If a change needs a field somewhere this file does not allow, stop and ask the owner; a new use needs a decision in `docs/decisions/`.
