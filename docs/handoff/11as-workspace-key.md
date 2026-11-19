# 11as — Each workspace uses its own tracker key (issue 438, step 1)

## Built

- **Storage.** `workspace_keys` and `workspace_key_changes` (`lib/schema-keys.ts`, migration `0048_workspace_keys`). The key is sealed with AES-256-GCM under the new `WORKSPACE_KEYS_SECRET`, with a random 12-byte nonce per write and the workspace id as associated data. The row keeps the ciphertext, the nonce, the last 4 characters, the status (`unset`, `ok`, `invalid`, `out_of_quota`), when the status was set, and the quota left. `lib/workspace-keys.ts` is the only place a key is opened, at call time. `WORKSPACE_KEYS_SECRET` is validated in `lib/env.ts`, added to `secretsOf` and `.env.example`. Without it the feature is off.
- **Alliance settings** at `/w/[slug]/settings`, linked as "Alliance settings" in the signed-in header and from Home's key card.
  - The key goes in a password field. `POST /api/w/[slug]/tracker-key` checks it at the boundary (`lap_` and 8–200 characters).
  - Saving claims the request id, then makes one `/quota` call on that key. A 401 or 403 stores nothing and answers 422 `key_refused`; a 5xx or no answer stores nothing and answers 503.
  - The screen shows only "Key set, ends in ••••abcd", the state, the quota left and when it was checked. Actions: Replace, and Remove (asked first).
  - Each change writes Home's line "<Name> updated the tracker key" or "<Name> removed the tracker key", and `ws_action` `tracker_key` / `save` or `delete`. Words in EN, PT-BR and FR.
- **Home card.** "Add your tracker key" with no key; for OGs on the site's key, "read with the site's key for now"; "Your tracker key needs you" when the key is `invalid` or `out_of_quota`, with the reason.
- **/admin.** Per workspace: "Tracker key: not set" or "Tracker key: set · <status> (<when>)". No last 4, no quota, no action.
- **Squads read per key** (`lib/squads-read.ts`; one call split into `lib/squads-call.ts` for size).
  - Every workspace with a usable key of its own is read on that key. The OGs workspace keeps `LAP_API_KEY` until its officers save a key. A workspace without a key gets no read.
  - Each alliance's batch runs alongside the others', with its own claim. `squad_reads` is now keyed by day and alliance.
  - A workspace key's day starts with one `/quota` call on it and keeps only the 100-call margin.
  - A 401 marks the key `invalid` and stops; a 429 or an empty quota marks it `out_of_quota` until 00:00 UTC. Neither falls back to our key.
- **A changed master key** (coordinator, after the first commit). A saved key that `WORKSPACE_KEYS_SECRET` no longer opens reads as `reenter`, not `invalid` (now from the fingerprint, see below). They say the key must be pasted again because the site's security setting changed. The squads read stays off for that workspace until a key is saved. /admin also says that changing `WORKSPACE_KEYS_SECRET` makes every saved key need to be entered again. The status is part of the migration itself.
- **Security review fixes** (coordinator, after the review of 8704b3f1):
  - Save and test is rate-limited: 5 tests per 15 minutes per workspace and per officer, refused ones included, in `auth_attempts`. The sixth answers 429 `rate_limited` with a plain line in EN, PT-BR and FR.
  - Only a 401 marks a key `invalid`. A 403 stops that night's read (`key_forbidden`), and on save answers 503 like a 5xx; the key is not marked.
  - Each row keeps `master_fp`, a truncated HMAC of a fixed label under the master key. A row sealed under another secret reads as `reenter`, worked out at read time and never written, so a deployment with another secret cannot damage the rows. The earlier write-on-view (`markUnreadableKeys`) is gone. Only a real decrypt failure under a matching fingerprint marks the row `reenter`.
  - Keys must have 32–128 characters after `lap_`; real keys have 43, measured by length only.
  - The leak scan also covers analytics payloads, and a new test checks that an error carrying the key is redacted in `run_logs` and `app_errors`.
- **Docs.** D124 and its index line, ARCHITECTURE entries, a tracking-plan row.
- **Tests.**
  - `lib/workspace-keys.test.ts`: the seal's round trip and associated data; the real adapter sending `/quota` with the workspace key; OGs on the env key only until it saves one; a workspace without a key not read; 401 → invalid and reads stop; 429 → out of quota, no call on our key, reads again after the reset.
  - `app/(private)/api/w/[slug]/tracker-key/route.test.ts`: a member and another workspace refused; the test call on the workspace key, once per request id; a scan of answers, page read, /admin read, activity, `run_logs`, `app_errors`, tables and console for the key.
  - `member-session.test.ts` got the route's fixture.

## Decisions

- **D124** (new). D123 is #439's, now on dev.
- **The daily roster read stays on our key** (assumption; stated in D124). It is the public member-history read of all 20 tracked alliances, and the workspace's Members tab reads that same row. Putting a tracked alliance's call on its workspace key would either leave a public gap when that key fails, or need the fallback to our key that this task forbids. So in this step the squads read is the only read that runs on a workspace key. A workspace's own daily read on its own key is for an alliance outside the 20 (issue 438 point 5).
- Saving a key the tracker refuses (401/403) stores nothing, and a key already saved stays. So the `invalid` status comes only from a later read.
- Each alliance's batches run concurrently, not in turn. Two ticks a night are about the time OGs alone needs (D117 amendment), so taking turns would leave a second workspace with no squads.

## Deviations

- The build preamble `BUILD-PREAMBLE.md` named in the task was not in the scratchpad. I followed CLAUDE.md and the 11ao e2e setup instead.
- Lint limits required one move for size: one squads call went to `lib/squads-call.ts`. On the rebase over #440, dev's own `lib/repo/desk-activity-thefts.ts` was kept, and the thanks line moved into the activity switch's default with the tracker key's. Neither changes behaviour.
- At 360 px the header's account row now wraps (`flex-wrap`). Without it, the new link cut the officer's name ("Você entro…") in PT.
- An app test cannot import `lib/sources` (lint zone). So the real-adapter header check is in `lib/workspace-keys.test.ts`, and the route test records the key its fake `fetchQuota` receives.

## Verified

- `pnpm check` passes after the rebase on #440: prettier, eslint, tsc, 1,174 tests (216 files), migration drift, i18n.
- After the rebase, all 49 migrations applied from an empty local Postgres 18, `0048_workspace_keys` included. A Settings e2e on the new build passed 20 of 20 checks at 360 (EN, light) and 1280 (PT, dark):
  - a refused key stores nothing; a good key is saved and tested, and only its last 4 characters are shown;
  - Replace keeps one key, and Remove empties it;
  - the sixth test within 15 minutes is refused with no tracker call, and every test went out on the workspace's key;
  - a row with another master key's fingerprint reads as "enter again" on Settings and Home, and the row is not written;
  - no page carried a key.
- Migration `0048_workspace_keys` applied on a real local Postgres 18 (`db:local:migrate`), including dropping `squad_reads_pkey`.
- Local e2e on the production build, a local Postgres, a Discord sign-in stand-in and a tracker stand-in. 95 of 95 checks pass at 360 and 1280, light and dark, EN and PT:
  - Home asks for the key, and the field is a password field;
  - a refused key is not stored;
  - only the last 4 are shown;
  - Home shows the activity line, and the card goes away;
  - Home says why the key is paused;
  - Remove empties the key;
  - each save sent exactly one `/quota` call, on the workspace key, and none on ours;
  - OGs' Home says the site's key is used for now;
  - no page's HTML carried the key;
  - /admin shows set/not set and the status, with no last 4 and no quota.
- 74 screenshots are in the scratchpad's `11as-shots/`.

## Open issues

- With several workspaces, each tick starts one batch per workspace at once, so the tracker gets one paced call stream per key. This was not measured with more than two alliances.
- Each workspace's `squads.*` lines are under the same `/admin/runs/daily/[day]`, told apart by `union_id`; that page shows no alliance name for them yet.
- Rotating `WORKSPACE_KEYS_SECRET` makes every stored key `reenter`, and officers must enter their keys again. There is no re-encryption step.
- The Discord command, the board and the translate features need no key and are unchanged.

## Next

- Model/effort: keep. Step 2 of issue 438 (per-workspace settings: language, glossary names, bot install link, Discord channels, delete) is settings forms on `/admin` and Alliance settings, the same shape as this step.
- What the owner must do first:
  1. Generate the master key: `openssl rand -base64 32`.
  2. In Vercel → laptracker → Settings → Environment Variables, add `WORKSPACE_KEYS_SECRET` with that value, Production only, marked Sensitive. Redeploy.
  3. Keep it. Changing WORKSPACE_KEYS_SECRET makes every saved tracker key need to be entered again. Each workspace's officers would then paste their key again in Alliance settings.
  4. Optional: OGs officers can enter OGs' own key in Alliance settings. Until they do, OGs keeps reading on `LAP_API_KEY`.
- Plan change: none. The workspace track has no prompt in `docs/SESSION_PLAYBOOK.md`; this work runs from issue 438.

<adjustments>
- Alliance settings (`/w/[slug]/settings`, `app/(private)/w/[slug]/settings/page.tsx`) already exists with one section. Step 2's officer-side settings go there as more sections, not on a new page.
- `squad_reads` is keyed by (day, union_id) and `squadTargets` (`lib/workspace-keys.ts`) decides which alliance reads on which key. Point 5 (an untracked alliance's own daily read) should reuse `squadTargets`' rule and `checkKey`, and add the daily read as a second read per target.
- The Discord channels setting (point 6) can store webhooks with `sealKey`/`openKey` and the workspace id as associated data, and the same master key.
</adjustments>
