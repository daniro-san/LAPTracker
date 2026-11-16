## D80 — Member facts: one version per field write, combined notes and languages, a sheet import that only fills empty fields, and a roster before the first end-of-day read (2026-11-16, 11f, issue #297)

Why: officers record onboarding facts about members (main squad might, AD Tech %, troops, time zone, languages), statuses and notes, and several of them edit the same card. The owner's rule (#293): writes are field-level and append-only, a stale same-field edit gets 409 with the newer value, and notes and languages are combined. The OGs spreadsheets are imported once. The owner also asked (2026-11-16) that every workspace show its members before its first end-of-day read (D72).

- **The table.** `member_facts` (migration `0021`): one row per write of one field of one member, append-only. Fields: `squadMight`, `adTech` (0–100), `troopTier` (1–12), `timeZone` (an IANA zone), `languages` (codes from a list of 18), `status` (`break` or `help`), `away` (`{ text, until }`, `until` a server day or null) and `notes`. `value` is jsonb; null clears the field. `source` is `message` ("from a message"), `officer` ("typed by an officer") or `sheet` ("from the sheet"). `version` counts the writes of that field, unique per (workspace, uid, field). `written_by` is the officer's `workspace_users` row. A uid gets facts only while it is in the alliance's newest roster (`access.unionId`, D71). The reads and writes are in `lib/repo/member-facts.ts`; the rules are in `lib/private/member-facts.ts`.
- **Concurrency.** A write names the version the officer saw.
  - Same as the newest: it is stored as the next version.
  - Another officer saved since: `notes` keeps the newer text and adds the lines the stale edit added; `languages` keeps the newer list, drops what the stale edit removed and adds what it added. Both are stored as the next version and answered `merged`. Any other field is refused: 409 with the newer value, version and source. A stale write of the value already stored is not a conflict.
  - Two writes of the same version at the same moment: the unique version lets one in, and the other is answered as a conflict.
  - A save sends only the fields that changed. Each field is written on its own, so a 409 on one field leaves the others saved. The editor shows the newer value with "Keep theirs" and "Use mine".
- **Statuses** (D75). A status set by an officer (On a break, Needs help) shows instead of the computed one. An away note whose last day is today or later (server day) shows On a break until that day. A member on a break has no Check in reasons and is left out of the thanks. An away note without a day is shown on the card only. Needs help keeps the reasons as lines under it and leaves the Check in filter. The KvK reason stays held (`KVK_REASON_ON = false`); away notes now exist, so the owner can decide to turn it on.
- **"Paste what they told you"** (`lib/private/onboarding-parse.ts`, pure). It reads pasted text or OCR lines, for 11k.
  - A number is taken when it carries its unit (`%`, `M`, `K`) or when every line that holds one agrees. The game's translation shows a message twice, and the OCR can misread one copy.
  - A bare number of 100,000 or more is squad might. A percentage is AD Tech. A bare number up to 100 next to AD, duel, research, pesquisa or tech is AD Tech.
  - A time zone is read from a country name (en, pt-BR, fr), or an abbreviation written in capitals (PST; "est" is French for "is"). A city or an offset counts only after "time zone", "fuso", "fuseau" and the like ("nome" is Portuguese, not America/Nome).
  - Languages are read when named (English, português, français …).
  - What it finds fills the editor's fields marked "from a message". Nothing is saved until the officer taps Save; a value the officer edits becomes "typed by an officer".
- **Time zones** (`lib/private/time-zones.ts`). The list is `Intl.supportedValuesOf("timeZone")`. The browsers' ICU names some zones by their old names (Node 26 lists `Europe/Kiev`, `Asia/Calcutta`). Each zone is mapped back to its IANA name with the country it is in, from the tz database's `zone.tab` (tzdata 2026f, 418 zones, generated into `lib/private/zone-table.ts`). The search covers:
  - city;
  - country names in en, pt-BR and fr (`Intl.DisplayNames`), and a few other words (UK, England, USA, EUA, BR);
  - a curated list of abbreviations, each with its usual zone first (PST → Los Angeles, BRT → São Paulo, CET → Paris …);
  - offsets: "-3", "UTC+1", "ST +3". ST is server time, SERVER_TZ.

  The zones already used in the alliance come first; then an abbreviation's usual zone, an exact word, and a country's usual zone. An offset alone also offers the fixed IANA zone of that offset (ST +3 is `Etc/GMT-1`). "Their time now" lists the zones whose clock reads that time, to the quarter hour. The stored value is always an IANA zone.

- **The sheet import** (`lib/private/sheet-parse.ts`, `lib/private/sheet-import.ts`, `/w/[slug]/import`).
  - **Columns.** Found by their header: Name, Role, Troops/Troop LVL/soldier tier, First Squad/Might, AD%, Timezone. Any other column is listed as not imported. A might column in which every number is below 1,000 is in millions; an AD column in which every number is 1 or less is a fraction.
  - **Time zones.** One is taken only when it names one zone ("US - CST" → Chicago, "Belgium" → Brussels, "ST +3" → `Etc/GMT-1`); otherwise it is shown as not understood.
  - **Matching.** Rows are matched to the alliance's current members: by a name a person confirmed before (`name_aliases`), else by `lib/screenshot`'s `matchName` over each member's current name and every name they had in this alliance's daily rosters (`member_names`) and event rosters. Other alliances' rows are not read (D71), so a name used only before joining is not known.
  - **Open rows.** A doubtful row offers its suggestions; a row with no match is answered by a person: a member, or "not a member". The answer is remembered as an alias. A null uid is a remembered dismissal.
  - **Writing.** Nothing is written until every row is matched or dismissed. Values go only into fields with no value yet, as "from the sheet", so an officer's or a message's value is never overwritten, and importing a sheet again writes nothing.
  - **Left out.** The sheets' notes, statuses ("Watch"), communication and participation columns. D71 says retention must be decided before officer notes are imported from the sheets. The participation records belong to #298.
- **Members before the first end-of-day read** (owner, 2026-11-16, any workspace). When the alliance has no end-of-day read yet, the Members tab lists its newest roster of any kind, by `access.unionId`: a daily read's members (D60), an event's Start or End, or a sample (D69), even a stale one.
  - Sanctuary and rank come from the newest Start or End that lists the member; anything a member lacks is "—".
  - Nothing is computed from it: no reasons, no New, no missing info, no status. The facts and an officer's status still show.
  - One line says "Roster from <time> server time · donations and activity come with the first end-of-day read, after <DAILY_ROSTER_AT> server time."
  - The first end-of-day read replaces it.
- **Privacy.**
  - The routes run the work through `privately` (`lib/private/http.ts`): an error reaches `app_errors` and the admin alert as a code alone, because a database error's message quotes the query's parameters, which would be what an officer typed.
  - The sheet is read in memory and never stored or logged; only its facts and the confirmed names stay.
  - Two PostHog events without properties, `ws_facts_saved` and `ws_sheet_imported` (D77's closed list). `/w` stays masked in replay.
