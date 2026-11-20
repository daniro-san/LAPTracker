## D124 — Each workspace reads on its own tracker key: entered by its own officers, stored encrypted, tested on itself, and never falling back to ours (2026-11-19, owner, 11as, issue 438 step 1; amends D117)

Why: the desk opens to other alliances (issue 438). Today the squads read (D117) spends `LAP_API_KEY`, the OGs key, for `OWN_ALLIANCE_ID` only. Before any other alliance gets a quota-spending read, each workspace must spend its own key. The owner (2026-11-19): the workspace's own officers enter the key on a settings screen in their desk; the owner never sees or handles another alliance's key; /admin shows only whether a key is set and its last status. This is step 1: the other workspace settings come later.

**Storage** (`workspace_keys`, `lib/schema-keys.ts`, migration `0048_workspace_keys`).

- One row per workspace: `ciphertext` (base64 of the AES-256-GCM ciphertext and its 16-byte tag), `nonce` (12 random bytes, new on every write), `master_fp` (which master key sealed it: the first 16 hex characters of HMAC-SHA256(secret, `laptracker/workspace-key/v1`), not a secret), `last4`, `status` (`unset`, `ok`, `invalid`, `out_of_quota`, `reenter`), `status_at` and `quota_remaining`.
- The master key is `WORKSPACE_KEYS_SECRET`: 32 bytes, base64 (`openssl rand -base64 32`), checked in `lib/env.ts`, a Vercel Sensitive variable, and one of `secretsOf`. The associated data is the workspace id, so a row copied to another workspace does not open.
- Without `WORKSPACE_KEYS_SECRET` the feature is off: no key is saved or used, Settings says the keys are not set up, Home shows no key card, and the squads read runs as before (OGs on `LAP_API_KEY`). Nothing crashes.
- Only `lib/workspace-keys.ts` opens a key, at call time, for one run. No route, page, /admin read, log, `run_logs`, `app_errors`, Discord message or analytics event carries it. A key sealed under another master key reads as `reenter` (amendments below).
- `workspace_key_changes`: who set or removed the key and when, one row per request id (unique per workspace). Home's line reads it; the key is not in it.

**The officers' screen: Alliance settings** (`/w/[slug]/settings`, linked as "Alliance settings" in the signed-in header beside Sign out, and from Home's key card).

- Officers only: `requireWorkspace`; a member's session, another workspace's session or none gets 401 `signed_out` from `POST /api/w/[slug]/tracker-key`.
- The key goes in a password field. The route checks it at the boundary: `lap_` and 32–128 of `A–Z a–z 0–9 _ -` (real keys have 43 after `lap_`, measured by length on our own key; the minimum keeps the 4 shown characters a small part) (the shape `lib/redact.ts` masks everywhere), else 400.
- **Save and test.** The request id is claimed first, then one `GET /v1/quota` is sent on that key only (no retry; INVARIANT `keys.test-own-key`).
  - 200 with quota left: stored as `ok` with the quota.
  - 200 with none left, or a 429: stored as `out_of_quota`.
  - 401: nothing stored, 422 `key_refused` ("The tracker refused this key. Check it and try again."). A key already saved stays.
  - A 403, a 5xx or no answer: nothing stored, 503 `tracker_unreachable`.
  - At most 5 tests per 15 minutes per workspace and per officer, refused tests included (INVARIANT `keys.test-rate-limit`, counted in `auth_attempts` like the PIN): the sixth answers 429 `rate_limited`, with no tracker call, and the screen says "Too many tests of a key just now. Wait 15 minutes, then try again." A repeat of a request id that went through is not counted. Without it, a loop of wrong keys sent to `/quota` under our User-Agent could get the site blocked.
  - A refused or unanswered test frees the request id, so the same form can try again. A repeat of a request id that went through answers the key as it stands and makes no second call (D100).
- The screen shows only "Key set, ends in ••••abcd", the state, "Quota left: n" and "Checked … ago". Actions: Replace (the same form) and Remove (asked first; the row goes back to `unset`).
- Each save or removal: a request id, Home's line "<Name> updated the tracker key" or "<Name> removed the tracker key" (never the key), and `ws_action` with feature `tracker_key`, action `save` or `delete`.
- EN, PT-BR and FR words in `lib/private/dictionary.settings.ts`.

**/admin.** The Workspaces card shows per workspace "Tracker key: not set", or "Tracker key: set · <status> (<when>)". It reads only `set`, `status` and `status_at`, never the ciphertext, the last 4 or the quota. /admin cannot read, change or remove the key.

**Which reads use which key** (`squadTargets`, INVARIANT `keys.own-quota-only`).

- **The squads read** (D117) runs for every workspace with a usable key of its own, on that key. Usable: `ok`, or `out_of_quota` set before the latest 00:00 UTC reset. `invalid` waits for Replace.
- **OGs.** Until the OGs officers save their own key, the workspace of `OWN_ALLIANCE_ID` keeps reading on `LAP_API_KEY`, so nothing breaks. This holds for OGs only. Once OGs saves a key, OGs reads on that key, and a 401 or 429 on it stops OGs' reads too: no fallback. Remove puts OGs back on `LAP_API_KEY`.
- **A workspace without a key gets no squads read.** Home shows "Add your tracker key" with a link to Alliance settings. For OGs on the site's key, the card says squads are read with the site's key for now.
- **Public reads keep our key and do not change:** event snapshots, samples, the Friday check, rehearsals, and the daily roster read of the 20 tracked alliances.
- **The daily roster read** (D60, D72) is read here as a public read. It feeds the public member history of all 20 alliances, and the workspace's Members tab reads that same row. Moving a tracked alliance's call onto its workspace key would make a public gap whenever that key fails, or need a fallback to ours. So it stays on our key: one call a day per tracked alliance, which we spend anyway for the public pages. A workspace's own daily roster read on its own key belongs to an alliance outside the 20, which issue 438 builds later (its point 5).
- **Each alliance's batch runs alongside the others'.** Every batch has its own claim, its own 100 s deadline, its own row in `squad_reads` (whose key is now day and alliance), and the tracker gets one paced call stream per key. A tick in the window starts the next batch of every alliance due. The outcome the route answers is the first alliance's status (OGs first), with every batch's calls added up, and `more` when any alliance has members left.

**Quota guard per key** (D117's rule, applied to each key).

- On a workspace key the day's first batch sends one `/quota` call on that key (counted in the day's calls), then follows each answer's `quota.remaining`. The reserve is `SQUADS_SAFETY_MARGIN` (100) only: a workspace key funds none of our event reads, so D117's KvK reserve stays on `LAP_API_KEY`.
- On `LAP_API_KEY` (OGs without a key of its own) nothing changes: no quota call, the day's read's numbers, the margin plus the event reserve.

**Failure stays in its workspace.**

- A 403 on a workspace key stops that night's read (`key_forbidden`) and does not mark the key: a 403 says nothing sure about the key.
- A 401 on a workspace key, at the start or on any member, marks the key `invalid` and stops that day's read (`key_invalid`). The next days skip that workspace until an officer replaces the key.
- A 429, or a quota answer of 0, marks the key `out_of_quota` with quota 0 and stops the read (`quota_429` or `key_out_of_quota`). The next day after 00:00 UTC it reads again; its first `/quota` call sets `ok`.
- Neither ever retries on `LAP_API_KEY`. A 5xx keeps D117's one retry, on the same key.
- The reason shows on that workspace's Home (the key card: "The tracker refused your key, so squads are paused. Replace it.", or "Your key has no quota left today…"), in Alliance settings and on /admin.
- A workspace key's `run_logs` lines carry its `union_id`. They hold counts, the quota left and reasons. The key is masked by `lib/redact.ts`'s `lap_` rule and is also passed as a secret to that run's logger.

**A changed master key: `reenter`** (owner, 2026-11-19, after the first review of this decision).

- A saved key that `WORKSPACE_KEYS_SECRET` no longer opens reads as `reenter`. The tracker never refused it, so it is not `invalid`, and officers are not told "The tracker refused this key".
- **Worked out from the fingerprint, never written** (security review, 2026-11-19). Each row keeps `master_fp`. Alliance settings, Home, /admin and the squads read compare it with the current secret's; a different one reads as `reenter` and the read skips the row. Nothing is written because of a mismatch, so a deployment with another secret (a preview, a mistake) can never damage the stored rows: once the right secret is back, the keys work again.
- Only a key that fails to open under its own master key (matching fingerprint, damaged bytes) is marked `reenter` in the row. No tracker call is made for either.
- The squads read stays off for that workspace until an officer saves a key again. Saving tests the new key as usual.
- Alliance settings and Home's card say: "This key needs to be entered again. The site's security setting changed, so the saved key can no longer be read. Paste it again in Alliance settings." (EN, PT-BR, FR.)
- /admin shows "Tracker key: set · needs to be entered again", and above the workspace list: "Changing WORKSPACE_KEYS_SECRET makes every saved tracker key need to be entered again."

**Owner steps.**

1. Generate the master key: `openssl rand -base64 32`.
2. Add it to Vercel Production as `WORKSPACE_KEYS_SECRET`, marked Sensitive, and redeploy.
3. Keep it. Changing WORKSPACE_KEYS_SECRET makes every saved tracker key need to be entered again. Each workspace's officers then paste their key again in Alliance settings. OGs goes back to `LAP_API_KEY` only if its officers remove their key.

**Tests** (one per behaviour): the seal's round trip and a wrong workspace id failing (associated data); the key in no answer, page read, /admin read, activity line, log line or console line; a member and another workspace refused; the test call on the workspace key, never on `LAP_API_KEY` (through the real `/v1` adapter with `fetch` stubbed); a 401 marking the key invalid and stopping the reads; a 429 marking it out of quota with no call on our key, and reading again after the reset; a workspace without a key getting no reads; OGs on the env key only, until its own key is saved; a row sealed under another master key left untouched with no tracker call, and shown as `reenter`; a key that fails to open under its own master key marked `reenter`, not `invalid`; a 403 stopping the night without marking the key; a sixth test within 15 minutes refused with 429 and no call; an error carrying the key redacted in `run_logs` and `app_errors`; the leak scan also covering analytics payloads.

**Amendment (2026-11-19, 11aw, issue 450): the squads read can be turned off per workspace (D126).** `squadTargets` leaves out a workspace whose "Squads read" switch the owner turned off on /admin; its stored squads stay. OGs keeps the read on by default.

**Amendment (2026-11-20, issue 451, D129).** `sealKey` and `openKey` take the secret's purpose as part of the associated data: a tracker key stays `laptracker/workspace-key/<id>` (rows already saved open as before); a notice webhook is `laptracker/webhook-<channel>/<id>`. Changing `WORKSPACE_KEYS_SECRET` also makes every saved webhook need to be pasted again.

**Amendment (2026-11-20, D133, issue 459).** A workspace's alliance outside the tracked set is now in the daily read, on its own key when it saved a usable one. Without a saved key, or with the keys off, it is read on `LAP_API_KEY`. With a saved key that cannot be used now, it is not read, and never on ours. A 401 or 429 on that key marks the key and fails only that alliance. The tracked alliances' daily read stays on our key.
