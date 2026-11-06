# 08ze — Viewer settings: own time zone and date order (#26, #27)

## Built
- `app/_ui/ViewerSettings.tsx`: the header's settings gear (option A of the Phase 1 mockups, owner's pick 2026-11-05). It replaces the theme switch in `SiteHeader`. The panel has three groups of `RadioField`s:
  - Theme: Light / Dark. Uses `useTheme` and `setTheme`, now exported from `ThemeSwitch.tsx`.
  - Times: Server time / Your time, with the zone's city under "Your time".
  - Dates: Auto, `31 Oct`, `Oct 31`, `31/10`, `31.10`, `2026-10-31`. Each sample is built in the viewer's locale.
- The panel renders only after the gear is opened. `Disclosure` gained an `onToggle` prop for this.
- `lib/brand/components/Gear.tsx`: the gear icon. It drew in the 20 px line style of the sun and moon icons.
- `app/_ui/format.ts`:
  - New exports: `ZONE_COOKIE` (`tz`), `DATE_COOKIE` (`date`), `DATE_FORMATS`, `parseDateFormat`, `ClockView`.
  - `makeClock(locale, timeZone, view?)` takes the view. With `own`, times end in "your time". With a date format, `day`, `weekday`, `long` and `at` use that order, built with `formatToParts`.
  - New `Clock.zone` field: "Server time" or "Your time".
- `app/_ui/locale.ts`:
  - `requestClock` reads and validates both cookies. A bad zone or format falls back to server time and the locale's dates.
  - New `parseZone`: `isTimeZone`, now exported from `lib/env.ts`, plus a 64-character cap.
  - New `requestServerClock`, used by the four /admin pages.
- The three Details tables put `clock.zone` in their corner instead of `copy.ledger.serverTime`.
- `AdminShell` passes `times={false}`: on /admin the gear shows the Theme group only.
- `lib/copy.ts`: `site.settings`, the `settings` group, `ledger.yourTime` and `time.yourTime`.
- /brand: "Settings gear" specimen under Components (`lib/copy-brand.ts` `components.settings`).
- Tests:
  - `app/_ui/format.test.ts`: no-cookie output is unchanged, own zone, each format, weekday/long/at, the allow-list.
  - `app/_ui/locale.test.ts`: zone cookie validation.
- Docs:
  - DESIGN.md: the time rule, header rule, dark-mode sentence, `header`, `theme-switch` and a new `viewer-settings` entry.
  - DECISIONS.md: D38. `app/globals.css`: one comment.

## Decisions
- Wording: a time in the viewer's zone reads `16:01 your time`, and the table corner reads `Your time`. I didn't use offsets because the owner ruled out a UTC twin. I didn't use IANA ids as words because they can read like `Etc/GMT+2 time`.
- Date formats offered: the four in the issue plus `31/10`, because Brazil and Spain write `31/10` and Russia `31.10`. `hhmm` is always 24-hour. The admin-only `stamp` keeps its full numeric date.
- /admin stays in server time. Its schedule is set in server time, and the operator compares against it. Discord (`lib/notify.ts`) has its own server clock and is untouched.
- The `tz` cookie stores the browser's IANA zone at the moment the viewer picks "Your time". "Server time" and "Auto" delete their cookie, so no cookie means today's behaviour.
- /brand's own header keeps the plain `ThemeSwitch`. The component stays in use there.

## Deviations
- None from the task. The gear moved to `lib/brand/components/Gear.tsx` because `lib/copy.test.ts` counts SVG path data in `app/` as words.

## Verified
- `pnpm check`: green. Prettier, ESLint, tsc and the migration-drift gate pass; 38 test files, 161 tests pass (1 skipped, pre-existing). 6 of those tests are new.
- No cookies:
  - Setup: a second `next dev` ran an untouched `origin/dev` copy against the same seeded local Postgres.
  - Pages compared: `/`, `/events/2`, `/events/3/alliances/67111155`, `/players`, `/players/340024664389` and `/admin`.
  - Result: `<title>` and `<main>` text are identical on all six.
- With cookies (curl, `/` status line and title):

  | Cookies | Status line | Title |
  |---|---|---|
  | Moscow + `dd.mm` | `31.10, 19:01 your time` | `Sat, 31.10` |
  | Los Angeles + `d-mmm` | `31 Oct, 09:01 your time` | — |
  | Next update, Los Angeles (after the DST change on Nov 1) | `7 Nov, 04:00 your time` | — |
  | Tokyo | `Nov 1, 01:01 your time` | stays Sat |
  | Invalid zone + invalid format | `Oct 31, 14:01 server time` | — |
  | `date=iso` | `2026-10-31` everywhere | — |

  /admin with cookies set stays in server time.
- Browser flow:
  - Setup: Playwright with system Chrome at 360 px, light and dark. The browser zone was set to Europe/Moscow, then America/Los_Angeles.
  - Steps: open the gear, pick "Your time", then a date order. The page re-renders immediately.
  - After reload: the chosen zone and format are shown, and the Details corner reads "Your time".
  - Cookies: `tz` and `date` are 365 days, SameSite=Lax.
  - Console: no warnings or errors other than local avatar 404s, so no hydration warning.
  - /admin: the gear lists Theme only. /brand: the specimen opens with no horizontal scroll at 360 px.
- Screenshots: 360 px, light and dark, Moscow and Los Angeles, page and open panel. They were sent to the owner and are not committed.
- Upstream API calls made: 0. No Neon database was touched; everything ran on a throwaway local Postgres.

## Open issues
- The upstream banner sits in the root layout, so on /admin it follows the viewer's setting while the rest of /admin is in server time.
- Without JavaScript the gear opens an empty panel. The old theme switch also needed JavaScript.
- A viewer who travels keeps the zone they saved. The panel shows the saved city; picking "Your time" again saves the new zone.
- At UTC+10 and east the event's weekday reads Sunday in "Your time" (the event is 14:00 UTC).
- Not done: the "Exact numbers" toggle could also move into the gear. DESIGN.md keeps it in the title row by the owner's rule.
- Pre-existing, not changed:
  - The stop hook runs `pnpm check` in the main checkout, not the session's worktree.
  - PGlite `beforeAll` hooks time out at 10–30 s when the machine is loaded (load average about 40 today). They pass when rerun.
  - Turbopack `next dev` once kept a stale `lib/copy-brand.ts` module until it was restarted.

## Next
Session: 9 — Dry run against production.
Model / effort: keep — opus high. This change does not touch the collector, the cron path or quota.
Owner must do first: merge this PR into `dev`. No migration, no new environment variable.
Plan changes needed: none.

<adjustments>
- /admin and its run pages are still in server time (`requestServerClock`), whatever cookies the browser has. Times read from /admin, `run_logs` and Discord need no zone conversion.
- If the owner's browser has a `tz` or `date` cookie, public pages show "your time" or a different date order. That is expected, not a bug in the dry run.
</adjustments>

<adjustments for="Session 10">
- The README should explain that public times say "server time" by default. The gear (last header control) switches them to the reader's own time ("your time") and changes the date order. /admin and Discord always use server time.
</adjustments>

<adjustments for="#60 translation">
- Where the language switcher fits: add a fourth `Group` ("Language") at the top of `Panel` in `app/_ui/ViewerSettings.tsx`, above Theme. Each option shows the language's own name, so it reads without English.
- It goes inside the same `times` check, so /admin (English only) does not show it. Rename the prop (for example `publicPage`) when adding it.
- Saving it follows the `pickDate` pattern: a `lang` cookie for a year, then `router.refresh()`.
- The server side reads `lang` in `requestLocale` (`app/_ui/locale.ts`), so the Clock and number formats follow too.
- Russian labels are longer: the panel is `min(20rem, 100vw − 2rem)` wide and the Times and Dates rows already wrap their help line.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/115
