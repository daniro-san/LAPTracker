## D105 — The members' board: a read-only page for regular members behind a 30-day member session (2026-11-17, owner, 11z, issue 331; amends D71, D73)

Why: the owner told an officer that regular members "can log in but will just see the calendar of events and the notices". Under D71 and D73 a member with no leadership role landed on "No access". The persona panel of regular members (issue 301, 2026-11-16) shaped the first slice, and the owner approved it on issue 331. The issue asked for "D80"; D80 was already taken, so this is D105.

Amends D71's "Regular members are out of scope" and "Leadership only", for this one page only. Amends D73's no-access reasons: `no_role` is no longer reached from the sign-in.

**Who gets in.**

- The sign-in (D71, D73) is unchanged up to the role check: Discord OAuth, then the member's roles in the workspace's Discord server.
- A leadership role, or an allowlist entry that still runs, gives an **officer session**, exactly as before (D99: role checked every 24 hours, seven days at most).
- Anyone else who is **in the workspace's Discord server** gets a **member session**. That includes an officer whose role was taken away and an allowlist entry that has expired.
- Outside the server: `not_member` (or `allowlist_expired`), as before. A blocked account stays blocked.
- The member is stored in `workspace_users` (Discord id and display name) like an officer, so that `blocked` and "Sign out everyone" reach them.

**The tier.** `workspace_sessions.tier` is `officer` (the default, so every session from before stays an officer's) or `member`. A renewal renews only a session of the same person and tier. When the tier changes, the browser's old session is deleted and a new one is made.

**Session length: 30 days** (`MEMBER_SESSION_MS`). There is no role check in between. A trip through Discord on a phone whose browser is not signed in to discord.com shows Discord's sign-in page, and that is what loses members. After 30 days the board sends the browser through Discord silently (`prompt=none`), as D99 does for officers.

- Cost: someone who leaves the Discord server keeps the board for up to 30 days. The board shows only what officers chose to show members, which is posted to the members' Discord channel anyway, and nothing about any person.
- "Sign out everyone in this workspace" on `/admin` also ends member sessions.
- **"Sign out members"** (owner, 2026-11-17), beside it on `/admin`'s workspace card, ends only the member sessions of that workspace; officers stay signed in. It asks first in a sheet ("Sign out every member in /w/<slug>? Officers stay signed in. …"). It is `POST /api/admin/workspaces/sign-out-members {workspace_id}`, behind the PIN with the PIN's rate limits (D3), like the card's other actions. A member who still belongs signs in with Discord again.
- The officer rules (D99) do not change.

**The two doors.**

- `requireWorkspace` serves only a session whose tier is `officer`; any other tier is refused with the reason `member`. `createSession` has no default tier: every caller names one. Every officer page sends it to `/w/[slug]/board` (`refuse.ts`). Every officer API route answers `401 {"code":"signed_out"}`, the same answer as no session.
- `requireBoard` gives a `BoardAccess`: a different branded type with no `WorkspaceAccess`, so no officer read can take it. It admits a member session (until its end) and an officer session (with the page rule of D99), so officers can preview the board.
- `app/(private)/api/w/[slug]/member-session.test.ts` walks every route under `api/w/[slug]` except a commented exclusion list (login, where sign-in starts, and logout, which every tier uses; the board and how-to are pages, not API routes). Each route and method has a minimal valid request in a fixture map (origin, JSON body or picture, query), so it passes its own checks and reaches the session check. No session and a member's session must both get `401 signed_out`, and the same request with an officer's session must not get 401. A new route without a fixture fails the test, and so does one that answers before its session check.
- Sign out works for a member session too.

**Where a member lands.** A member's sign-in always ends on `/w/[slug]/board`, whatever page was asked for. `/w/[slug]` and every desk page send a member there.

**What the board shows** (`lib/private/board.ts`, `/w/[slug]/board`, read-only, EN · PT · FR):

1. **This week.** The next seven server days, today first. Only Calendar entries with "Members can see this" (`for_members`). Each entry shows:
   - its title;
   - its time on the viewer's own clock (the browser's zone, "15:00 your time"), with server time beside it ("16:00 ST");
   - its notes and its link;
   - its linked notice (D102), only when members can see that notice too.

   This week's Alliance Duel theme, when marked, sits above the days. Caravan seats (coach, VIP, Guardian), authors and edit history are never read into the board.

2. **Notices.** The notices whose newest `for_members` is "true" and whose `ends_on` is empty or not before today's server day. Newest change first, each with "Until <day>" or "No end date". The text shows in the viewer's language. The other written languages are tabs, one tap away. When the viewer's language is not written, the board says so and shows the first written one. A language behind the newest one (D81's `basis`, `staleOf`) says "This translation may be behind the newest version. The other languages are one tap away." above its text. No author, no history.
3. **Start here.** See below. Under it, "Questions? Ask in #<channel> on the alliance's Discord." with a link to the Discord server (`https://discord.com/channels/<server id>`).
   - The channel name is the `members` channel's `name` in `WORKSPACE_DISCORD_WEBHOOKS` (D102), the same variable the notice publish uses, so no new setting was needed. For the OGs that is `guides-and-beyond` (owner, issue 331).
   - Without that entry the line is left out.

**What it never shows** (issue 331's no-gos, D75): officers' names or data, roster fields, statuses, notes, member facts, per-member lists, "my stats", rankings, online, coordinates, join date, avatars, caravan seats. The board has no public or unlisted link: every view goes through the sign-in. The response is `private, no-store`, and the `/w` layout's static metadata (D73) holds.

**Start here** (`start_here`, migration 0031; `lib/private/start-here.ts`; `/w/[slug]/start-here`; `POST /api/w/[slug]/start-here`).

- One record per workspace. Officers edit it; members read it.
- Per language (en, pt-BR, fr) it holds three texts: "Words we use" (the glossary, up to 4,000 characters), "Alliance rules" (about 10 lines, up to 3,000) and "Who to ask" (up to 1,500).
- Each language is one field under issue 293's rule. A save names the version of each language it changes. A language another officer saved since is refused (409), with who saved it and when, and nothing is written. Two officers saving different languages both keep their change. The save locks the record's row.
- It starts empty: the board says "The officers have not written this yet." until an officer writes it.
- **Translate** (owner, 2026-11-17), as in the notices editor (D81): "Translate to …" sends each part of the language in view that has text through the notices' draft route (`POST /api/w/[slug]/notices/draft`, `kind: "translate"`) into the other two languages. Each translated language becomes a draft in its fields, marked "Draft from Translate, not saved", with Accept and Undo and "Partly untranslated, please check." when it came back so. Nothing is saved until Save. A part over the translator's 3,000 characters (`DRAFT_LIMIT`) is not sent, and the editor says so. Without `GROQ_API_KEY` the button is off and says why. Tests and the e2e use a stand-in for Groq; no real call.

**Officers' way in.** "See what members see" sits under the Calendar's views (Week · Caravans · Notices · Thefts), where the "for members" switches are set. On the board, an officer sees "You are seeing what members see." with "Back to the Officers' Desk" and "Edit Start here".

**Words changed.**

- The notice editor's "Show to members" help, "Members cannot see notices yet. Turn this on to have it ready.", now reads "Members see it on their board, with its end date. Leave it off for leadership plans like KvK." (PT and FR to match).
- The Calendar's "Members can see this" help loses "(coming soon)".
- The sign-in lead no longer says "For the alliance's leadership". It says members see this week's plan, the notices and Start here, and officers also get the Officers' Desk.
- "No access" for a blocked account said it "no longer has access to the Officers' Desk". A blocked member now sees it too, so it reads "This Discord account no longer has access to the alliance's pages here: the members' board or the Officers' Desk. Ask an R5 if this is a mistake." (PT and FR to match).
- No decision quoted these strings.

**Logs.** `w.sign_in` and `w.renewed` carry `member: 0|1`. Nothing else is logged by the board.

**Not built (later, issue 301):** a calendar feed, weekly thanks, "my EB/caravan line", self-report, Spanish, push.

**Persona panel round (2026-11-17, 11z; a new member, an adversarial reviewer, a copywriter).**

- **Preview.** An officer on the board sees a plum strip that stays at the top while scrolling: "Preview: this is what members see" and "Back to the Officers' Desk". The header reads "Previewing as a member", with no officer name, and a line says "Only events and notices marked for members are here." "Edit Start here" sits in the Start here section.
- **What the page is.** Under the title: "Your officers keep this page. New here? Start here ↓", the last part a jump to Start here. The "This week" heading under the title "This week in the alliance" is gone.
- **Language.** A block not in the viewer's language carries a tag on its card: "English only for now" (one language written) or "Not in Portuguese yet" (several). The tabs open on the viewer's language when it is written. In the editor, a part written in one language and empty in another shows "PT is missing “Who to ask”." under the tabs.
- **Times.** "15:00 your time (BRT) · 16:00 ST": the zone's short name in the viewer's language, from the browser (`Intl`, `timeZoneName: "short"`; English may read "GMT-3"). A notice an event links to says "See the event above for your time."
- **Links.** An event's link is labelled by where it goes: "Open in Discord" for discord.com, discord.gg or discordapp.com, otherwise "Open link (opens example.com)". The link to an event's notice reads "See notice".
- **Who to ask.** The editor's help says every member sees it and suggests roles or channels rather than one person. Names are not blocked: it is the officers' choice.
- **Copy.** Empty Start here: "Nothing here yet. Your officers are working on it." A notice with no end day: "Stays up until removed". Portuguese "Signed in as": "Você entrou como {name}" (the whole workspace). `/admin`: "Allowlist: empty".
- **`/admin` buttons.** "Sign out members only (officers stay signed in)" comes first, in the neutral style; "Sign out everyone, including me" second, in a danger style (D73 and D99 amended). The sheet names the count of member sessions open: "Sign out 2 members in /w/ogs? …" (`listWorkspaces` counts them with the open sessions).
- **Translate drafts.** Accept and Undo are full 44 px buttons beside "Draft from Translate, not saved"; the fields holding draft text are tinted and ringed in plum until accepted or undone. Each part is sent and placed back on its own; the same line in two fields in the earlier screenshots came from the test stand-in, which answered every text with one fixed sentence.
