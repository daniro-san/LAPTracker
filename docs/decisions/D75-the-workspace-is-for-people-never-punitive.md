## D75 — The workspace is for people, never punitive (2026-11-16, owner principle, 11c)

The owner: "everything we do has to be in favour of the people, not to punish them; it exists to make the day easier, so they enjoy the game more and touch fewer spreadsheets." Refined the same day: not punitive does not mean hidden.

Every workspace screen (D71) follows these rules.

- **Data we failed to capture is never counted against anyone.** No screenshot, a failed read or nothing marked shows as "no data" (—). It is never 0, never counted in a comparison or a status, and never a reason to look at someone.
- **Data that shows something real is shown clearly to the leadership, with its evidence, as a "Check in" reason.** The leadership decides what to do: talk to the person, or remove them in the game. The app never decides, never applies a consequence by itself, and never hides a real signal. The owner's three examples:
  - **Offline for more than 2 days.** On 2026-11-16 the API returned `last_online_at` as null for every member. Until it returns, the signal is a proxy: weekly `active` and `daily_tech` both unchanged over 2 full days, i.e. across 3 consecutive end-of-day reads (D72), ignoring the Monday reset (on a Monday the activity is compared with 0). A missing read or an unknown value ends the run. Amended in 11e (review of #329): the earlier wording, "across 2 consecutive end-of-day reads", read as 1 day; 3 reads match the owner's "offline for more than 2 days" (`IDLE_STEPS` in `lib/private/member-week.ts`).
  - **Might not growing.** D70 already has an officer view of might that has not moved.
  - **Zero kills in a KvK with no away note recorded.** From the event's per-member kills gained (issue #271).
- **Thanks first.** The weekly view leads with top contributors, the most improved, event MVPs and completed events. "Might need a hand" comes after, as observations, never as a ranking of the worst.
- **Statuses describe, for the leadership only:** Fine / Check in / On a break / Needs help. There is no "To remove" or "Expel" status, and the app never suggests a penalty or an expulsion.
- **Away and new members** are left out of every comparison.
- **Generous defaults.** In a roll call, unmarked is "unknown", never "missed". The bubble bulk action is "no problem seen".
- **Nothing about a member is shown to other members** (D71 keeps the workspace leadership-only). The theft log (issue #321) protects our members and targets thieves from outside.
- **Wording.** Neutral and factual, for example "no activity for 2 days, no away note". Never "flagged", "warned" or "violation".
