## D104 — Follow-up: the week's list from the Members rules, append-only officer records, resolved for the week (2026-11-17, 11y, issue 340; uses D70, D75, D80, D97, D98, D100)

Why: the leadership wants one weekly worklist: who to look at, why, and what the officers already did. The bottom bar's fifth tab ("Follow-up", "Acompanhar", "À suivre") was faded with "soon".

- **The page.** `/w/[slug]/follow-up`, the fifth tab. Top to bottom:
  - the title and the help line "These are notes for you. Nothing is sent and nobody is removed from the alliance.";
  - "Week 16 – 22 Nov" (the game week that holds today, server days), then "{n} to look at · everyone else is fine", or "Nobody to look at this week." when the list is empty (before the first daily update, also "Reasons to check in come with the first daily update.");
  - one row per member: the name, the rank, the reasons in yarn, "Note what happened" and "See in Members" (the Members list searched by the name);
  - "Thefts to follow up · n": the attackers of the thefts log whose follow-up is Open or Open again (D97), with the state and this week's count, and one link to the thefts log. The thefts UI is not repeated here.
- **Who is on the list.** The Members rules as they are, not a copy (`lib/private/follow-up-rules.ts` `worklist`):
  - **Check in**: `whoOf` (D98) says "checkin", so the reasons are `membersView`'s: the offline proxy and might unchanged (D70, D75), and the KvK reason only when `KVK_REASON_ON`. No donation reason (D75, D98). A member on a break, or with an officer's status, is not Check in.
  - **Onboarding**: a new member (`isNew`) not on a break with main squad, AD Tech or time zone not recorded (`factsToAsk`, limited to the three facts issue 340 names). Shown as "New · still to ask: Main squad, AD Tech, Time zone".
  - A member with both has one row with both lines.
  - Order: by name. No ranking (D75).
  - **Pending members (D106) are left out**, even with onboarding facts missing. They already head the Members tab under "New members" with their facts editor, and a follow-up row is keyed by the game uid, so it would not move with D106's fact move when the roster matches them. Once matched, a pending member is a new roster member and joins this list if a fact is still missing. **Former members (D107)** are not in `membersView`, so not on the list either. A record is refused (`not_member`) for anyone not in the newest roster, although `saveFacts` takes former and pending uids.
- **Officer records.** "Note what happened" opens a sheet with four answers and a note of up to 500 characters:
  - "Talked to them";
  - "On a break" with "Last day away (ST)", today or later: the member's `away` fact (D80) from today to that day, with the note as "What they said";
  - "Needs help": the member's `status` fact (D80);
  - "All fine".

  Each record is one row of `member_follow_ups` (migration `0031_follow_up`): uid, action, note, until, who, when, and the sheet's request id (unique per workspace, D100: a retry stores nothing new). The two status answers write the fact first with the version the page saw; another officer's newer value is refused with 409 and "Another officer changed this just now: {value}. Save again to replace it."; a second Save sends the newer version. Nothing is sent anywhere.

- **Leaving the list.** Any record takes the member off the list for the rest of that game week (Monday to Sunday, server days; `resolvedIn`). A member also leaves by themselves when the signal clears (activity changed, might moved, a break started, the facts were recorded). If the signal still holds next week, the member is on next week's list again: a talk is about that week.
- **History.** The member card (`memberCard`, the Members sheet) shows "Follow-up notes", newest first, one line per record: "Talked Mon 16 Nov: back after exams · Ana", "On a break Mon 16 Nov – Fri 20 Nov · Ana", "Needs help, …", "All fine, …". The officer name is the desk name (D87).
- **Privacy.** The route runs in `privately`; notes are never logged. The page and route check the session first (D71, D99).
