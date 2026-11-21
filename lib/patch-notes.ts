// /admin/changes: what each release changed and what it needs from the owner, newest first. Static data,
// English only (D48). Before running Prepare release, add the release's entry on top (CONTRIBUTING.md).
// Plain words for the owner: what changed for officers, members, the public or the owner, and why. No file
// names, secrets, webhook URLs or member data; no player names. `#123` in a text links to GitHub.

export interface PatchNote {
  version: string;
  /** The day the release was published, YYYY-MM-DD (UTC). */
  date: string;
  title: string;
  changes: string[];
  needsYou?: string[];
  prs?: number[];
}

export interface OwnerTodo {
  text: string;
  issue?: number;
  done?: boolean;
}

export const REPO_URL = "https://github.com/daniro-san/LAPTracker";

/** Steps only the owner can do, open ones first in the order they matter. */
export const ownerTodo: OwnerTodo[] = [
  {
    text: "Browser notifications: add VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY (Sensitive) and VAPID_SUBJECT in Vercel (Production), or ask Claude to do it, then redeploy. Then test on a real iPhone (Home Screen icon) and on Android Chrome.",
    issue: 558,
  },
  {
    text: "Set the Raid Shield channel (Alliance settings → Discord) before Friday 23:30 ST; without it no summary is posted.",
  },
  {
    text: 'For the OGs alliance, Discord: on its desk, Alliance settings → Discord, tap Check, save both webhooks and send a test message. When /admin shows both channels as "set", delete WORKSPACE_DISCORD_WEBHOOKS in Vercel.',
    issue: 527,
  },
  {
    text: "For the OGs alliance, Raid prep: check once that the Raid Shield check is allowed on /admin and turned on in Alliance settings → Features. Optional: turn on the Raid Shield summary (it needs the Raid Shield channel) and check Saturday's time (10:00 by default).",
    issue: 527,
  },
  {
    text: "Guide: sign in once at /w with the new Discord permissions, then review the guide screenshots of /w and Alliance settings → Features.",
    issue: 527,
  },
  {
    text: "Send the invite link and the guide PDF to the new alliance when you like.",
    issue: 527,
  },
  {
    text: "PostHog → Error tracking → Alerts: connect the admin Discord channel as a destination (paste its webhook there yourself), then ask Claude to send the error alert to it.",
    issue: 527,
  },
  {
    text: "cron-job.org: on the /api/tick job, turn on Notify on failure by email.",
    issue: 527,
  },
  {
    text: "GitHub: check that your notification settings email you about failed scheduled Actions runs. The uptime check relies on it.",
    issue: 527,
  },
  {
    text: "Neon → Billing: set a spending limit or alert of about US$ 10 a month, if the option exists.",
    issue: 527,
  },
  {
    text: "Neon → Branches: delete leftover preview branches. Keep main and any branch you use.",
    issue: 527,
  },
  {
    text: "Around 2026-11-28, look at Neon's compute graph. If it is well below 100 CU-hours a month, consider the Free plan. Then decide between Neon and Supabase.",
    issue: 527,
  },
  {
    text: 'Vercel previews: they are blocked (Ignored Build Step is "production only"). Decide whether to keep it that way or turn previews back on.',
    issue: 527,
  },
  {
    text: "Neon pooler: confirmed. The production DATABASE_URL comes from the Neon integration, which fills it with the pooled address.",
    issue: 527,
    done: true,
  },
  {
    text: "PostHog query key: POSTHOG_QUERY_API_KEY created and added in Vercel.",
    issue: 484,
    done: true,
  },
  {
    text: "PostHog query key: the Endpoint: Read scope is added, and /admin Activity shows numbers.",
    issue: 484,
    done: true,
  },
  {
    text: '/admin Activity: action counts (notices, roll call marks, thanks, screenshots) are now shown exactly; people counts keep "under 5".',
    issue: 484,
    done: true,
  },
  {
    text: "Neon compute capped at 0.5 CU with scale to zero on, and the site's functions moved to iad1, next to the database.",
    issue: 527,
    done: true,
  },
];

export const patchNotes: PatchNote[] = [
  {
    version: "v5.43.0",
    date: "2026-11-21",
    title: "Insights: Raid Shield history",
    changes: [
      "Insights has a Raid Shield history (when the Raid Shield check is on): for the last 8 Fridays, the share of members seen with a shield at the night check and at the morning check.",
      'Alliance totals only, no names. A week or check with no reading shows "no reading", never 0%; a check still running shows "under way".',
      "The section explains that these are the tracker's map scans, so the night share is usually low: most shields turned on for the raid show only in the morning.",
    ],
    needsYou: [
      "After the next raid, compare the two shares with Raid prep's own counts for that week.",
    ],
    prs: [582],
  },
  {
    version: "v5.42.0",
    date: "2026-11-21",
    title: "Insights: KvK cost and recovery, and squads seen",
    changes: [
      "Insights has a KvK section: how much might the alliance lost in the last KvK and how much is back, day by day, plus up to 3 older KvKs.",
      '"Took a heavy hit — maybe offer help": members who lost more than 25% and are still under 80% of their might before the KvK, names only, never a ranking. Members on a break are left out.',
      "A Squads seen section (when the squads read is on): how many members have 1, 2 or 3+ squads seen, how fresh the sightings are, and the strongest squad's might in four groups. Counts only, no lineups.",
      "Both sections use stored data only, with no extra calls to the tracker.",
    ],
    needsYou: [
      "After the next KvK, check the help list and the recovery days on the desk; they were tested on invented data only.",
    ],
    prs: [579],
  },
  {
    version: "v5.41.0",
    date: "2026-11-21",
    title: "Desk pages read less of the database as data grows",
    changes: [
      "An audit of every read of a table that grows forever, measured on one invented year of data (10 alliances).",
      "The Officers' Desk Home and Members pages now spend about half the database time per view (42.8 → 21.0 ms), and that time no longer grows as members' history grows.",
      "/admin reads each roll call's first mark from a new index instead of reading every mark.",
      "Every number on every page stays the same; an old-versus-new check compared them on the same data.",
    ],
    prs: [576],
  },
  {
    version: "v5.40.0",
    date: "2026-11-21",
    title: "Member cards close and stay closed on a phone",
    changes: [
      'On a phone, closing a member card sometimes flickered, showed "Loading…" and opened the card again. It now closes at once, with no trip to the server, whichever way you close it (X, tapping outside, Escape or the back gesture).',
      "Cause: the page address kept the member after the card closed, and the browser's back step reopened it.",
      "Shared links to a member still open that member's card. The same fix covers Former members and Follow-up.",
    ],
    prs: [573],
  },
  {
    version: "v5.39.0",
    date: "2026-11-21",
    title: "Browser notifications for officers",
    changes: [
      'Officers can get notifications on their phone or computer: Alliance settings → Notifications → "Enable on this device". Each device and each use has its own switch.',
      'Four uses: the Raid Shield count after each shield reading (again only if it changes), a "This is me" claim waiting for approval, Calendar roll call reminders, and a failed night read (off by default).',
      "Notifications show counts and a link only, never a member's name, because they appear on lock screens.",
      "On iPhone and iPad they work only after adding the desk to the Home Screen and opening it from that icon; the card explains how.",
      "Nothing changes until the VAPID keys are set in Vercel: the card stays hidden until then.",
    ],
    needsYou: [
      "Set the VAPID keys in Vercel (or ask Claude to), redeploy, then test on a real iPhone and on Android.",
    ],
    prs: [570],
  },
  {
    version: "v5.38.0",
    date: "2026-11-21",
    title: "Raid prep marks itself from the tracker's night and morning checks",
    changes: [
      'Raid prep no longer claims a shield length. The tracker reports the same shield type for an 8 h and a 24 h shield, so a row now says only "shield seen" and when the map was scanned. The "May end before KvK" tag is gone.',
      "After Friday night's shield reading (before the server reset), the tracker marks ✓ for every member it saw with a shield.",
      'After Saturday morning\'s reading, it marks ✓ for members still seen with a shield and ✗ "No shield seen" for the rest. Nothing is erased: each row keeps a small history, for example "Night · 22:33 ST: shield seen" and "Morning · 07:15 ST: no shield seen".',
      'Marks the tracker wrote say "from the tracker". A notice at the top asks an officer to check them; "Checked" hides it. Members with a morning ✗ are listed first, and their ready message asks for the shield.',
      "An officer's own ✓ or ✗ always wins: the tracker never writes over it. Away members are skipped, and nothing is posted to Discord from this step.",
      "If the week's Raid prep roll call doesn't exist yet, the first reading creates it.",
    ],
    prs: [567],
  },
  {
    version: "v5.37.0",
    date: "2026-11-21",
    title: "The Raid Shield summary gets its own channel, and squads show 2 in front and 3 behind",
    changes: [
      'Alliance settings → Discord has a third card, "Raid Shield channel". The Raid Shield summary posts only there. If no Raid Shield channel is set up, no summary is posted; it never goes to the leaders\' channel.',
      "A summary posted before this change is not edited again. The next shield window posts a fresh one in the Raid Shield channel.",
      "Member card squads: the 2 front heroes (the tanks) sit on top and the 3 back heroes below, the same on a phone and on a computer. The old staggered shape is gone.",
    ],
    needsYou: [
      'Before Friday 23:30 server time: in the OGs alliance\'s Alliance settings → Discord → Raid Shield channel, paste the webhook of #laptracker-ledger, then tap "Send a test message".',
      "Open one of your squads on the member card and check that the 2 heroes on top are your front row (tanks). If not, tell Claude which positions are swapped.",
    ],
    prs: [563, 564],
  },
  {
    version: "v5.36.0",
    date: "2026-11-21",
    title: "The alliance's week in one line, patch notes, and real setup dates",
    changes: [
      "Officers' Desk: Home and Members show the alliance's week in one line: how many members reached the 1,000 Alliance Help coins, the median of daily quest points, and the week's donations. Alliance totals only, no names (#466).",
      'Days with no read are named ("no read on Tue") and never count as 0.',
      "/admin has this Patch notes page, with your to-do list on top. Every release adds its entry here.",
      '/admin Activity: the setup steps (created, key saved, webhook set, first roll call marked, first notice published) now come from the site\'s own records, so OGs shows its real dates instead of "not yet".',
      '/admin Activity: notices, roll call marks, thanks and screenshots are shown as exact numbers. Officers active and board visitors keep "under 5" for privacy.',
    ],
    prs: [557, 559, 560],
  },
  {
    version: "v5.35.0",
    date: "2026-11-21",
    title: "The Raid Shield summary posts to forum channels",
    changes: [
      "The leaders' Raid Shield summary was not posted on KvK Saturday, 2026-11-21. The leaders' channel is a Discord forum, and Discord refuses a forum post that has no title.",
      'The first post now has the title "Raid Shield check". Later updates edit that same post.',
      "The shield readings were saved correctly the whole time, and the Raid prep page showed them. Only the Discord message was missing.",
    ],
    needsYou: [
      'At the next shield window (Friday 2026-11-27, 23:30 server time), check that the summary appears as a forum post titled "Raid Shield check".',
    ],
    prs: [555],
  },
  {
    version: "v5.34.0",
    date: "2026-11-21",
    title: "Members' daily figures kept out of session replay",
    changes: [
      "PostHog session replay recorded the height of the day bars on the officers' member card. From those heights someone could work out each member's daily coins and donations (#549).",
      "Every place on the Officers' Desk that shows a member's daily quest points, coins or donations, or sorts members by them, is now blank in replay: the member card's last 7 days, the Members list, the thanks top 3, caravan suggestions and the roll call picker.",
      "Replay records those parts as empty boxes of the same size. Nothing changes for people using the site.",
    ],
    prs: [553],
  },
  {
    version: "v5.33.0",
    date: "2026-11-21",
    title: "Public page fixes from the persona review",
    changes: [
      "Fixes the 6 bugs found by the persona review of the public pages (#473).",
      'Ledger columns line up, so a change no longer runs into the next column. Long names end in "…" instead of breaking in the middle of a word.',
      "When a Start and an End fall on different days, both show their day.",
      "Text on the leader's row is darker and easier to read. A player with no photo shows the drawn placeholder instead of a broken image.",
      "Players search shows might, level and a result count, and puts exact name matches first.",
      'Compare shows the plain difference and "1.1× the first". Standing over time shows ▲ and ▼ and says "stayed" when the rank held.',
      '"São Paulo" keeps its accent, and the header stays deep plum in dark mode.',
    ],
    prs: [551],
  },
  {
    version: "v5.32.0",
    date: "2026-11-21",
    title: "A member's own week on their Me page",
    changes: [
      "A member's own Me page on the members' board has a \"This week\" card: their own daily quest points, Alliance Help coins and donations, Monday to Sunday.",
      "It opens with a thanks line. Under each row is the member's own last week. There is no rank, no alliance average and no above or below wording.",
      'A day with no reading shows "No reading" and never counts against anyone.',
      'Only the member sees it, and only after an officer approved their "This is me" link. Map position, online times and the photo stay hidden, also from the member.',
      "You approved this on 2026-11-21, and the project's privacy rule for member data was changed to allow it.",
    ],
    prs: [548],
  },
  {
    version: "v5.31.0",
    date: "2026-11-21",
    title: "Usage numbers from PostHog on /admin and the desk",
    changes: [
      "/admin has an Activity section: for each alliance, totals for the last 7 days of officers active, board visitors, notices written, roll call marks, thanks shared and screenshots read.",
      "It also shows each alliance's setup steps with their dates: created, key saved, webhook set, first roll call marked, first notice published.",
      'Desk Home shows officers "Board reach": at least how many members opened the members\' board in the last 7 days.',
      "Only totals are shown, never names. A total under 5 is not shown.",
      "The numbers are read from PostHog, so the database gets no new tables.",
    ],
    needsYou: [
      "Check that the PostHog key (POSTHOG_QUERY_API_KEY) has the Endpoint: Read scope. When /admin shows Activity with numbers, close #484.",
      'Decide: should /admin show the four action counts (notices, roll call marks, thanks, screenshots) exactly, with 0 as "none", instead of hiding totals under 5? It is a one-line change.',
    ],
    prs: [546],
  },
  {
    version: "v5.30.0",
    date: "2026-11-21",
    title: "An Alliances table on /admin",
    changes: [
      "/admin has an Alliances table at the top of the workspace sections, one row per alliance.",
      "Each row shows tracker calls today and over 7 days against the key's 1,000 a day, the key's state, writing help and translations against their daily limits, Discord posts and failed posts, page errors in the last 24 hours, when an officer was last on the desk, and features changed from the defaults.",
      "Rows that need a look come first, with the reason on a chip. Tap a row to open that alliance's card further down.",
      "Counts and times only, read from our own tables. On a phone the rows are cards.",
    ],
    prs: [544],
  },
  {
    version: "v5.29.0",
    date: "2026-11-21",
    title: "Onboarding analytics for new alliances",
    changes: [
      "New PostHog events follow a new alliance's setup: the workspace created, the tracker key saved, and feature switches changed on /admin.",
      'The PostHog "Workspaces" dashboard shows requests and invites as weekly counts, and the setup steps per alliance: created, webhook set, first roll call marked, first notice published.',
      "The dashboard has an alert when one alliance's errors spike.",
      "The events carry no names, ids, keys or text.",
      "On /admin, a daily limit's Save and Reset buttons are disabled while a save runs, so a double tap does not save twice.",
    ],
    prs: [542],
  },
  {
    version: "v5.28.0",
    date: "2026-11-21",
    title: "Home and event pages cached",
    changes: [
      "The home page and the event pages reuse their database reads until the next update, like the other public pages since v5.27.0.",
      "In a burst of 96 page views there were 0 errors. Before, there were 14 to 19.",
      "When the database is down, member history still shows the last saved data.",
      "This was the last of the fixes for the Neon quota incident (#521), which is now closed. The fixes: the scheduler's 15-minute check looks at the clock before the database, /admin polls only when a run can start, a heartbeat every 3 hours, the watcher in GitHub Actions, Neon compute capped at 0.5 CU, and the functions in iad1, next to the database.",
    ],
    prs: [540],
  },
  {
    version: "v5.27.0",
    date: "2026-11-21",
    title: "Public pages cached, and a page for when the database is down",
    changes: [
      "Public pages (alliances, players, player search, member history) reuse their database reads until the next update. Repeat views make 0 database queries.",
      "In a burst of 48 views right after an update, page errors fell from 21–24 to 0.",
      'When the database does not answer, the page says "Data temporarily unavailable" in the viewer\'s language, with Try again, instead of an error.',
      "A page waits at most 10 seconds for the database.",
    ],
    prs: [537],
  },
  {
    version: "v5.26.0",
    date: "2026-11-21",
    title: "The member's Me page, and one database connection per page",
    changes: [
      'On the members\' board, a member taps "This is me" on their roster row. An officer approves it on Home\'s "To review" line before it counts.',
      "Every link waits for an officer, because Discord nicknames can change. The officer sees whether the Discord name matches the game name.",
      'One approved link per player, and a false claim cannot lock the real player out. An officer\'s own "This is me" is approved at once.',
      "Each page now opens one database connection pool instead of several. /admin went from 6 pools to 1 and from 74 to 50 database transactions per view.",
      'The "too many clients" database errors under load stopped: 0 in bursts of 39 pages, against up to 9 before.',
    ],
    prs: [534, 535],
  },
  {
    version: "v5.25.0",
    date: "2026-11-21",
    title: "An idle /admin tab stops asking the server",
    changes: [
      "An idle /admin tab no longer asks for updates every 20 seconds. It asks only in the 5 minutes after a scheduled check that can start a run.",
      "Links on /admin no longer load pages before you tap them.",
      "On an idle /admin tab, database transactions fell from 228 a minute to about 2.",
      "A new database index makes the member sightings lookup faster: 5 ms instead of 805 ms.",
      "Part of the fixes for the Neon quota incident (#521).",
    ],
    prs: [532],
  },
  {
    version: "v5.24.0",
    date: "2026-11-21",
    title: "Insights, the Follow-up panel, the roll call grid and fewer database wake-ups",
    changes: [
      "Officers get an Insights page: the week's pulse against the 4 weeks before, effort at every might level, quiet contributors to thank, and who joined and left.",
      'Follow-up names the facts still missing for each new member, opens a panel with a ready message in the member\'s language, and adds "A tip to share" for members below the 1,000 coin cap on most days.',
      'The roll call is a grid of tiles. Members already marked fold under "Marked (n)".',
      "A roster read that lists more members than the alliance's capacity leaves out the extra members with no rank (#481).",
      "The scheduler's 15-minute check looks at the clock before it touches the database, so Neon stays asleep when nothing is due (#521).",
      "A heartbeat runs every 3 hours, and GitHub checks the site and the scheduler right after it. A stopped scheduler is now noticed within about 3 hours.",
      "The site's functions run in iad1 (Virginia), next to the database, instead of São Paulo.",
    ],
    needsYou: [
      "About 7 days after this release (around 2026-11-28), look at Neon's compute graph and decide on the plan (#527).",
    ],
    prs: [520, 522, 523, 524, 525, 528, 529, 530],
  },
  {
    version: "v5.23.0",
    date: "2026-11-20",
    title: "Member card tabs, the read status bar and Raid prep",
    changes: [
      "The officers' member card is a short header over four tabs: Overview, Info, Squads and History. Overview shows the last 7 days of quest points, coins and donations.",
      "Squads shows the game's 5-slot lineup for each squad. Troop counts are never shown.",
      "Every desk page shows officers a thin status bar when a tracker read needs attention: the key needs pasting again, a roster read failed or is late, or the squads read is running or stopped.",
      'Raid prep for the night before KvK: the Raid Shield check reads every member on Friday night and again on Saturday. Officers mark "Shield" and "Squads off the wall", and each member gets a ready private message.',
      "An optional summary goes to the leaders' channel only.",
    ],
    needsYou: [
      "Check Raid prep once for OGs: allowed on /admin, turned on in Alliance settings → Features (#527).",
    ],
    prs: [514, 515, 517],
  },
  {
    version: "v5.22.0",
    date: "2026-11-20",
    title: "Sign in, every alliance on the server, and two-layer switches",
    changes: [
      "A \"Sign in\" link on the public site opens /w. One Discord sign-in finds every Officers' Desk or members' board the person belongs to.",
      "The tracker key form says where to get a key, and the link to the key page is fixed.",
      '/alliances lists every alliance on the ranks board. The top 20 by might are read every day, and "Get today\'s details" reads any other alliance once a day, at most 30 a day for the site.',
      "Squads are read as a daily queue on every 15-minute scheduled check, with retries, instead of in one time window. /admin and Alliance settings show today's progress.",
      'Feature switches have two layers: you allow a feature on /admin, and the alliance\'s officers turn it on. /admin has "Defaults for new alliances".',
      'A feature that is turned off is not shown at all. There is no "turned off" message.',
      "A notice's read page shows one language at a time in tabs, each with its character count and state.",
    ],
    prs: [502, 503, 504, 505, 506, 508, 510, 511],
  },
  {
    version: "v5.21.0",
    date: "2026-11-20",
    title: "Alliances set up their own Discord and Desk",
    changes: [
      "Officers add the bot, turn on commands and save their webhooks themselves in Alliance settings → Discord. You no longer send install links or edit Vercel for each alliance.",
      "Each webhook is checked against the alliance's own Discord server, stored encrypted and never shown back.",
      "A new alliance gets its Officers' Desk from a one-time invite link, or by requesting one at /w/request.",
      "/admin → New alliances lists the requests with a roster check, and makes invite links that work for 7 days.",
      "The invite takes 4 steps: sign in with Discord, pick the server, add the bot, then pick or create the roles.",
    ],
    needsYou: [
      'For OGs: in Alliance settings → Discord, tap Check, save both webhooks and send a test message. When /admin shows both channels as "set", delete WORKSPACE_DISCORD_WEBHOOKS in Vercel (#527).',
    ],
    prs: [497, 499],
  },
];
