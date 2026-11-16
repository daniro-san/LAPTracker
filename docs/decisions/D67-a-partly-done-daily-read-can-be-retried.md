## D67 — A partly done daily read can be retried, and a retry keeps the rosters already read (2026-11-16, owner, 08zzzw)

Why: the daily read of 2026-11-16 closed `partial`: 7 of 20 alliances failed with `v1.schema` (the parser, fixed in 08zzzv). D60's Retry took only a `failed` day or one left `running`, so `/admin` could not read those 7 again and their rosters for that day stayed missing. The owner: let the admin run a full retry of a day.

- **Which days.** Today's read (the server day) can be retried when its status is `failed` or `partial`, or when it was left `running` for at least `RUN_STALE_AFTER_MS` (150 s). A `complete` day, a day with no read and a read `running` for less than 150 s still answer 409 `daily_read_not_retryable`. A past day is never retried (D60: a read made today would be stored under that day's date).
- **What it reads.** Every roster in `DAILY_ROSTER_IDS` again, not only the ones that fell short: 1 + k calls (21). The budget rule, the 100 s deadline and the call cap are D60's.
- **What it keeps** (INVARIANT `daily-read.retry-keeps-rosters`). D60's retry deleted every row of the day at the claim. On a `partial` day that would throw away the rosters already read before the new read has one to put in their place: a retry during an outage, or one the quota rule stops, would leave the day with fewer rosters than before. So:
  - at the claim, only the day's error rows are deleted (`reclaimDailyRead`);
  - a roster the retry reads replaces the day's earlier roster of that alliance (`storeDailyRoster`, one upsert on the day and the alliance);
  - an error row is stored only when the day has no roster of that alliance;
  - an alliance the retry never reached keeps the roster it had, or has no row.
- **The outcome is the day's, not the attempt's.** After storing, the status, the failed list and the stale list are read from the day's rows (`dailyRosterStates`). An alliance whose new read failed while its earlier roster was kept is not listed as failed: the day has its roster. Its failed call still shows in the read's log and calls table (`/admin/runs/daily/[day]`). For a first read the day's rows are that read's rows, so nothing changes.
- **`/admin`.** The Retry card under "Run something now" also shows for a partly done day, with its own sentence. The confirmation says a roster already read today stays if its new read fails.
- **Discord.** The admin line of a `partial` day ends with `[Retry on /admin ↗] · [Daily reads ↗]`; a `failed` day keeps `[Retry on /admin ↗]`.
