# LAPTracker: admin guide

This is the guide for the alliance admin. It covers what the tool does, what happens on a Saturday, what each Discord message means, and where to look when something is wrong. Developers and the maintainer: see [CONTRIBUTING.md](CONTRIBUTING.md).

## What it does

LAPTracker records the Might and Kills of the 20 tracked alliances on server 325, twice for each Saturday event: once before the event (**Before**) and once after it (**After**). Every recording is kept, so you can compare any two events.

- **Might** is the alliance's total power.
- **Kills** is the total of its members' kills.

The numbers come from the game's data service (lastasylumtracker.com). Nobody types them in.

Three places show the results:

- **The public site.** The front page shows the newest event's table. Each event has its own page, and each alliance and player has a page. Members can read the site in 18 languages. The gear icon in the header sets the language, the theme, whether times are shown in server time or the viewer's own time, and the date order.
- **The public Discord channel.** One message per event, updated after the After snapshot.
- **The admin Discord channel.** Detailed messages for each run, the weekly check, and problems. Admin pages and Discord messages stay in English, in server time.

## The Saturday timeline

All times are **server time**, the clock the game shows. The times below are the documented setup. `/admin` → **Schedule** shows the times in use.

| When (server time)         | What happens by itself                                                                                              | What you do                                                               |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Friday 18:00               | A practice run (rehearsal) starts. Its verdict arrives in the admin channel about 50 minutes later.                 | Read the verdict. If it says ✗ Fail, tell the maintainer before Saturday. |
| Friday 20:00               | The weekly check posts to the admin channel: requests left, database size, and the next Before and After times.     | Check that the next times are right.                                      |
| Friday 22:00               | The daily request count resets (midnight UTC).                                                                      | Nothing.                                                                  |
| Saturday 10:00             | The **Before** snapshot starts at the first scheduler check after this time. The scheduler checks every 15 minutes. | Watch the admin channel. See the messages below.                          |
| Saturday, during the event | Nothing.                                                                                                            | Note in the game when the event starts and ends (server time).            |
| Saturday 14:00             | The **After** snapshot starts the same way.                                                                         | Watch the channel. Check that the event had ended before this time.       |

A snapshot starts at the first check after its due time, so it can start up to 15 minutes late. Saturday's times fall on the quarter hour, so they should start within seconds of their due time.

A snapshot takes about 10 seconds and uses 21 of the day's requests: one check and one for each alliance. On the practice run of 2026-11-05 (event 8) the two snapshots took 10.0 and 9.6 seconds and used 21 requests each, 42 for the practice run. Each alliance read took between 1.2 and 2.4 seconds.

## What the Discord messages mean

### Public channel

| Message                                             | Meaning                                                                                              |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| ✓ **Last updated at …**                             | The snapshot is complete. All 20 alliances have fresh numbers.                                       |
| ⚠ **Last updated at …**, with a line `○ n stale: …` | Partly done. The named alliances have numbers but no change figure (see [stale](#what-stale-means)). |
| ✗ **Last update failed at …**                       | Nothing was recorded. The admin channel says why.                                                    |

The rest of the message:

- `Before snapshot done at …`: on the After message, so the whole event is in one place.
- `n/20 alliances`: how many alliances have fresh numbers.
- `Might ▲` and `Kills ▲`: the three biggest gains of the event.
- `Next update at …`: when the next snapshot is due.
- On a manual round, the first line is `Manual round: <name>. Not a Saturday event.`

### Admin channel

| Message                                                      | Meaning                                                                                                                                                                 |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `[rehearsal]` in front                                       | A practice run on a test event. Not shown publicly.                                                                                                                     |
| `[manual]` in front                                          | A round you started by hand.                                                                                                                                            |
| ✓ / ⚠ / ✗ **Before snapshot: done / partly done / failed**   | The result of that snapshot.                                                                                                                                            |
| `due Sat, 11/07/2026, 10:00 server time · started +4 min`    | When it was due and how late it started. A few minutes late is normal.                                                                                                  |
| `12 calls · 988 requests left · 10.9 s`                      | Requests used, requests left today, and how long it took.                                                                                                               |
| `error: …`                                                   | The whole run failed or stopped early.                                                                                                                                  |
| `✗ failed [TAG] Name: …`                                     | One alliance could not be read.                                                                                                                                         |
| `○ stale [TAG] Name`                                         | One alliance was read, but its data was not fresh.                                                                                                                      |
| `run_logs write failures: n`                                 | Some log lines of the run were not saved, so its run log is incomplete. Check `/admin/errors`.                                                                          |
| `[Run 42 ↗]`                                                 | Opens the run's page.                                                                                                                                                   |
| `✓ Pass` / `✗ Fail` with checks                              | The practice run's verdict, one line per check (listed below).                                                                                                          |
| `skipped · …: reason`                                        | A scheduled practice run did not start. The reason follows.                                                                                                             |
| `✓ Weekly API quota check`                                   | The Friday check. ⚠ next to the requests or the database size means it is low or large.                                                                                 |
| `🔒 PIN entry is locked`                                     | Too many wrong PINs. Wait an hour. Scheduled snapshots still run.                                                                                                       |
| `✗ App error on …`                                           | A page or action broke; after `—`, the first line of the error's own message. See `/admin/errors` for the rest. At most one such message an hour while errors continue. |
| ✗ / ⚠ **Daily roster read 2026-11-12: failed / partly done** | The 06:00 roster read for member history fell short. Not sent when it is done.                                                                                          |
| `✗ v1 TimeoutError (12): [NSE], …`                           | The alliances that were not read, one line per reason. `not fetched: deadline` means the read stopped before reaching them.                                             |
| `↳ …`                                                        | Under each reason: what it means and what to do.                                                                                                                        |
| `[Retry on /admin ↗]` / `[Daily reads ↗]`                    | A failed day: open `/admin` and press **Retry**. A partly done day: see it in the runs list.                                                                            |

The practice run's verdict has six checks: both snapshots complete; every alliance fresh in both; the game's data moved forward for every alliance; the requests used equal the drop in the daily count; each run under 120 seconds; both snapshots started within 45 minutes of their due time.

### What to do on ⚠ or ✗

**⚠ Partly done.** Some alliances are stale or failed. The admin message lists them. Usually nothing needs doing: the other alliances' numbers are fine, and the stale rows show no change. If the missing numbers matter, tell the maintainer. Pressing Before or After again reads the failed alliances again, and the ones the run never reached; the alliances already read are kept as they are. It costs about one request per alliance it reads, plus one.

If the error line says **deadline**, the game's data service answered too slowly and the run stopped at 100 seconds. The public site shows a _Game data is delayed_ banner while this lasts. Wait, then press by hand.

**✗ Failed.** Open the run in `/admin/runs` and read the `error` line:

- **quota:** too few requests are left today. Do not press again. The count resets at midnight UTC.
- **`MAX_UPSTREAM_CALLS reached`:** the run used its safety cap of 120 requests. Tell the maintainer.
- **Anything else:** check the banner on the site. If the game data service is not answering, wait and try again later.

A run that ends partly done or failed also posts its own new message in the admin channel, below the event's message. An edit does not notify anyone, so check the admin channel after each snapshot.

If no message at all arrives within 20 minutes of a due time, open `/admin/runs`. If the run is not there, press the snapshot by hand (below). If it still does not run, tell the maintainer: the scheduler may have stopped.

## What "stale" means

The table compares Before and After for each alliance. An alliance is **fresh** when the game's data for it was updated within 20 minutes of the snapshot. Otherwise it is **stale**: the snapshot could not prove that the numbers are current.

On the table:

- **Fresh** rows have no mark. Their numbers and change are shown.
- **○ Stale**: the numbers are shown, but the change is left blank. Do not compare a stale alliance with anything.
- **✗ Failed**: the alliance could not be read at all.
- **– No data**: nothing was recorded for this alliance.

The stale and failed marks also appear on the time at the top of each column, so you can see which side of the event is affected.

A snapshot with any stale or failed alliance is **partly done** (⚠), never complete (✓).

## Running a snapshot by hand

Use this when the scheduler did not run, or to record a Before snapshot early on a weekday.

1. Open `/admin` and enter the admin PIN. The session lasts 7 days; **Log out** in the admin menu ends it sooner. When the PIN has been changed, every open `/admin` page logs itself out within about 20 seconds of the new PIN going live (the next deployment), with "The admin PIN has changed. Enter the new PIN to see this page."; enter the new one.
2. Under **Run something now**, press **Before** or **After**.
3. Read the confirmation (it names the cost) and confirm.
4. The page shows **A run is in progress** and checks every few seconds. It closes within about 100 seconds. The result appears at the top: ✓ done, ⚠ partly done or ✗ failed, with the requests used, the stale count and the failed count.

Things to know:

- **The Saturday event refuses a snapshot before its due time** ("Not due until …"). That is deliberate. Weekday practice goes in a manual round (below).
- **If that snapshot is already done**, the page asks _"This snapshot is already done. Take it again?"_ Say yes only if you mean to replace that phase's numbers.
- **Manual round.** For a test on a weekday: **Start a manual round** on `/admin`. Give it a name, choose who can see it, and whether it posts to the public channel. Then press its Before and After buttons. A manual round has no schedule and does not affect Saturday's comparisons unless you choose "history".
- **Rename.** **Rename** next to the current event on `/admin` changes its name on the public pages. You can rename the Saturday event from a day before its Before snapshot. Discord messages already sent keep the old name.
- **Daily roster read failed.** When today's 06:00 read failed (for example the game's data service timed out), `/admin` shows it under **Run something now** with a **Retry** button. It reads every roster again and costs about 21 requests. It only appears while today's read is failed, or when it started and never finished.
- **Practice run.** **Rehearse** runs a practice event with the full checks. It costs about 45 requests and takes about 50 minutes.
- **GitHub, if `/admin` is not reachable.** On the repository, open Actions → **tick** → **Run workflow**, and pick `before` or `after`.

## Where to look when something breaks

| Page               | What it shows                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/admin`           | Four sections. **Status**: the requests left (OK, Low under 900, or Unknown), what is running, the next scheduled run, and the last result. **Run something now**: the buttons, each with its cost. **Last rehearsal**: the verdict and its checks. **Schedule**: the times in use, read only.                                                                                                                                                                                                                                              |
| `/admin/runs`      | Every snapshot run and every daily roster read, newest first. A snapshot run is titled by its event's name; practice runs are marked `[rehearsal]`. Each row shows start, finish, duration, requests used and requests left. A run that stopped at the deadline is marked. **All**, **Events** and **Daily reads** filter the list. A daily read has no page of its own: its row lists why it stopped and the alliances that failed, by reason, with what each reason means and what to do; **Details** shows what the game's API answered. |
| `/admin/runs/[id]` | One run: an **Upstream calls** table (each request, its seconds, its HTTP status, whether it was cached and how many retries it needed), then the **Log**. A failed call's line says what the error means and what to do; **Details** shows the game's API answer (status, headers, the start of the body, or how long it waited). Start here to find out why a run failed or was partial.                                                                                                                                                  |
| `/admin/errors`    | Problems on the site itself (a page or action that broke), grouped by message, with a count, what it means and what to do. **Details** shows the error's own message, its cause and where in the code it broke: send that to the maintainer. "Nothing has broken" means there are none.                                                                                                                                                                                                                                                     |
| The public banner  | _Game data is delayed_: the game's data service has not answered for the last attempt. The numbers may be out of date.                                                                                                                                                                                                                                                                                                                                                                                                                      |

The header of `/admin` shows a small candle: it is lit while a run is in progress.

Read `/admin/runs` first, then the run's page, then `/admin/errors`. If the reason is still unclear, send the run's number (for example "Run 42") to the maintainer.

## Requests: the daily quota rules

- The game's data service allows **1,000 requests per day**. The day resets at midnight UTC, which is **22:00 on Friday** in server time.
- **Every request counts**, including ones that fail. A snapshot uses 21 requests: one check and one for each of the 20 alliances.
- **Retries** happen only for temporary errors (502, 503 and 504), up to three retries per request. One run may use at most 120 requests in total.
- **A run refuses to start** if fewer than 50 requests are left. That leaves room for the other snapshot of the day.
- **Too many requests (429)** stops the run at once. Tell the maintainer.
- **The weekly check** on Friday at 20:00 warns when fewer than 900 requests are left. `/admin` shows the same warning under Status.
- **Do not press repeatedly.** Each press spends requests. Wait for the message first.
- **The Friday practice run** (about 45 requests, 18:00 server time) is spent before the midnight UTC reset, so it does not reduce Saturday's budget. The Saturday pair (42) fits easily in the day.
- **If the count is lower than the admin channel expects**, someone else may be using the same key. Tell the maintainer.

## Words used on the site

- **Event**: one weekly event, a scheduled event normally on Saturday. It is named by its title, or by its date until the owner names it.
- **Snapshot**: one recording of the 20 alliances, Before or After.
- **Before, After**: the two snapshots of an event.
- **Might**: an alliance's total power.
- **Kills**: the total kills of its members.
- **Delta** or **change**: the After number minus the Before number, for one alliance.
- **\***, after a change: the total fell and at least one member left, so part of the fall comes from people leaving. It appears on Might and Kills.
- **Fresh, stale**: see [What "stale" means](#what-stale-means).
- **Manual round**: a round you run by hand, outside the Saturday schedule.
