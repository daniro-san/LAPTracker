// The member card's Raid Shield block (issue 634, option A; D137 and D136 amendments of 2026-11-22): only
// while the Raid Shield check is on, and only from Friday's night check (the alliance's time, 23:30 ST by
// default) until KvK starts
// (Saturday 12:00 ST), in server time. Outside that window it reads nothing and says nothing: nobody keeps a
// shield after KvK, so a past raid's "no shield seen" never stays on the card (D75). Raid prep's own rules
// and words: the raid from `raidOf`, the readings from the check's two windows of the workspace's own
// alliance (`shieldReadings`, the windows Raid prep reads), the checkpoints from `hintOf`, the week's Raid
// prep and the member's newest Shield mark there (`newestMark`, one row by index). An officer's mark leads (officer marks win, D137); the tracker's own marks do not, since
// its checkpoints say the same with their map time. A member away on the raid's Saturday gets only "Away on
// raid day" (D103, as the Discord summary counts them). Attack-relevant: never logged or cached (D137).
import { dateWords } from "../date-words";
import type { Db } from "../db";
import { weekRaidPrep } from "../raid-prep-fill";
import { newestMark } from "../repo/roll-call";
import { shieldReadings, shieldSettingsOf } from "../repo/shield-checks";
import { passWindows, raidOf, timesOf } from "../shield-check";
import { fill } from "../words";
import type { WorkspaceAccess } from "./access";
import { dayIn } from "./calendar-time";
import type { WorkspaceDictionary } from "./dictionary";
import { awayOn } from "./fact-fields";
import { featureOn } from "./features";
import type { MemberRow } from "./members";
import { hintOf, type Checkpoint } from "./raid-prep";
import type { Mark } from "./roll-call-rules";
import { markWord } from "./roll-call-words";

export interface ShieldLine {
  text: string;
  /** "map from 22:33 ST": the member's map scan, in server time; null for a mark or a state. */
  scan: string | null;
  /** `attention` for "no shield seen" and "No shield" when it leads; `muted` for what is under the lead. */
  tone: "plain" | "attention" | "muted";
}

export interface CardShield {
  /** "Raid Shield". */
  head: string;
  lines: ShieldLine[];
}

type At = { now: Date; zone: string; t: WorkspaceDictionary };

/** "Night check: shield seen" with "map from 22:33 ST" (Raid prep's tile words, issue 585). */
function checkLine(c: Checkpoint, t: WorkspaceDictionary, zone: string, tone: ShieldLine["tone"]) {
  return {
    text: fill(t["roll.prep.checkpoint"], {
      pass: t[`roll.prep.pass.${c.pass}`],
      state: t[c.on ? "roll.prep.on" : "roll.prep.notSeen"],
    }),
    scan: fill(t["roll.prep.scan"], { time: dateWords("en", zone).time(new Date(c.at)) }),
    tone,
  };
}

/** Whether `now` (epoch ms) is from the raid's night check until KvK starts. */
const during = (raid: { night: Date; kvk: Date }, now: number) =>
  now >= raid.night.getTime() && now < raid.kvk.getTime();

/** The member's Raid Shield block now, or null outside the window or with the check off. */
export async function cardShield(
  db: Db,
  access: WorkspaceAccess,
  member: Pick<MemberRow, "uid" | "facts">,
  at: At,
): Promise<CardShield | null> {
  if (!featureOn(access, "shield_check")) return null;
  const { t, zone } = at;
  const day = dayIn(zone, at.now.getTime());
  const now = at.now.getTime();
  // No night check starts before 23:30 ST (`DEFAULT_TIMES`): nothing is read outside the raid.
  if (!during(raidOf(day, { SERVER_TZ: zone }), now)) return null;
  // The alliance's own read times (issue 859): its night check opens the block, its windows count.
  const times = timesOf(await shieldSettingsOf(db, access.workspaceId));
  const raid = raidOf(day, { SERVER_TZ: zone }, times);
  if (!during(raid, now)) return null;
  const head = t["card.shield.head"];
  if (awayOn(member.facts, raid.saturday, zone))
    return { head, lines: [{ text: t["card.shield.away"], scan: null, tone: "plain" }] };
  const w = passWindows(raid.friday, { SERVER_TZ: zone }, times);
  const [night, morning, prep] = await Promise.all([
    shieldReadings(db, access.unionId, w.night.from, w.night.to),
    shieldReadings(db, access.unionId, w.morning.from, w.morning.to),
    weekRaidPrep(db, access.workspaceId, raid.friday),
  ]);
  const own = prep?.callId ? await newestMark(db, prep.callId, member.uid, "main") : null;
  const read = (rows: typeof night) => rows.find((r) => r.uid === member.uid) ?? null;
  const newestFirst = hintOf(read(night), read(morning)).checkpoints.reverse();
  // An officer's mark leads (a cleared one does not); under it, the newest checkpoint, muted.
  if (own && !own.tracker && own.mark !== null) {
    const mark = own.mark as Mark;
    const lead = {
      text: fill(t["card.shield.mark"], { mark: markWord(mark, "shield", t) }),
      scan: null,
      tone: mark === "no" ? ("attention" as const) : ("plain" as const),
    };
    const under = newestFirst.slice(0, 1).map((c) => checkLine(c, t, zone, "muted"));
    return { head, lines: [lead, ...under] };
  }
  if (newestFirst.length === 0)
    return { head, lines: [{ text: t["card.shield.notRead"], scan: null, tone: "plain" }] };
  return {
    head,
    lines: newestFirst.map((c, i) =>
      checkLine(c, t, zone, i > 0 ? "muted" : c.on ? "plain" : "attention"),
    ),
  };
}
