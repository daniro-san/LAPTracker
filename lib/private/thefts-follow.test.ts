// The thefts log after issue 321's last round (D97, amended 2026-11-19): three thefts from a report, our
// server and whom to contact, the five steps with their request id and the newest step seen, and when a
// screenshot match is enough to say "our server".
import { randomUUID } from "node:crypto";

import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb } from "../db.test-helpers";
import { listFollowUps, listThefts } from "../repo/thefts";
import { parseSecretOpsReport } from "../screenshot/parse-secret-ops";
import type { WorkspaceAccess } from "./access";
import { addTheft, setFollowUp, setServer, theftsView } from "./thefts";
import { saveSecretOpsDraft } from "./thefts-import";
import { CLOCK, NOW, NSE, seedThefts, signedIn as signIn, typed } from "./thefts.test-helpers";

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await seedThefts(db);
});

const signedIn = (slug: string): Promise<WorkspaceAccess> => signIn(db, slug);

/** An invented Secret Ops report as OCR lines: three thefts and one help from our own member. */
const REPORT = [
  "[NSE]Gremlin 11-15 13:46",
  "a dérobé vos récompenses de quête",
  "[QRX]Pebblewick 11-15 12:10",
  "a dérobé vos récompenses de quête",
  "[OGs]Grimbald",
  "vous a aidé à obtenir vos récompenses de quête 11-15 11:00",
  "[ZZT]Fernby 11-14 22:05",
  "a dérobé vos récompenses de quête",
];

describe("three thefts from a report (issue 321's done_when)", () => {
  it("say which attackers are on our server and which tracked alliance to contact", async () => {
    const [ogs, nse] = [await signedIn("ogs"), await signedIn("nse")];
    // The officer types what was taken from the report's item pictures (the OCR cannot read them).
    const entries = parseSecretOpsReport(REPORT).map((e, i) =>
      i === 0 ? { ...e, items: " 1.2M food, 300K wood " } : e,
    );
    const draft = { victimUid: 11, readAt: NOW, entries };
    expect(await saveSecretOpsDraft(db, ogs, draft, CLOCK)).toMatchObject({ saved: 3 });
    const stored = await listThefts(db, ogs.workspaceId);
    expect(stored.map((r) => [r.attackerName, r.items])).toEqual([
      ["Gremlin", "1.2M food, 300K wood"],
      ["Pebblewick", null],
      ["Fernby", null],
    ]);
    // From the player's profile: Pebblewick is on our server, Fernby on the enemy's. Not from NSE's desk.
    const pebblewick = { attacker: "name:pebblewick", server: 325 };
    expect(await setServer(db, nse, pebblewick, NOW)).toBe("not_found");
    expect(await setServer(db, ogs, pebblewick, NOW)).toBe("ok");
    expect(await setServer(db, ogs, { attacker: "name:fernby", server: 412 }, NOW)).toBe("ok");
    const view = await theftsView(db, ogs, CLOCK);
    const shown = view.groups.map((g) => [g.tag, g.attackers.map((a) => a.server), g.contact]);
    expect(shown).toEqual([
      // A tracked alliance of our server: its page and its leader (no public read with ranks here).
      ["NSE", [325], { unionId: NSE, name: "Natural Selection", leader: null }],
      // On our server but not tracked: no page to link.
      ["QRX", [325], null],
      ["ZZT", [412], null],
    ]);
    expect(view.ownTag).toBe("OGs");
  });

  it("follows an attacker through the five steps to resolved, each with who and when", async () => {
    const ogs = await signedIn("ogs");
    expect(await addTheft(db, ogs, typed({ uid: 22 }, 11), CLOCK)).toBe("ok");
    const steps = ["warned", "talked", "retaliated", "resolved"] as const;
    for (const [i, state] of steps.entries()) {
      const at = new Date(NOW.getTime() + i * 60_000);
      const step = { attacker: "uid:22", state, note: "", requestId: randomUUID() };
      expect(await setFollowUp(db, ogs, { ...step, expected: await latest(ogs) }, at)).toBe("ok");
    }
    const [group] = (await theftsView(db, ogs, CLOCK)).groups;
    const { followUp } = group?.attackers[0] ?? {};
    expect(followUp?.state).toBe("resolved");
    expect(followUp?.last).toMatchObject({
      by: "Ana",
      changedAt: new Date(NOW.getTime() + 180_000),
    });
    expect(followUp?.earlier.map((c) => [c.state, c.by])).toEqual([
      ["retaliated", "Ana"],
      ["talked", "Ana"],
      ["warned", "Ana"],
    ]);
  });
});

/** The id of the newest step of uid:22, as the card would send it. */
const latest = async (access: WorkspaceAccess) =>
  (await listFollowUps(db, access.workspaceId)).at(-1)?.id ?? null;

describe("a step's request id and the newest step seen (D100, D97 amended 2026-11-19)", () => {
  it("adds nothing on a retry, and refuses a step when another officer's came first", async () => {
    // Two sessions: `wren` stands for a card opened before Ana's step.
    const [ana, wren] = [await signedIn("ogs"), await signedIn("ogs")];
    expect(await addTheft(db, ana, typed({ uid: 22 }, 11), CLOCK)).toBe("ok");
    const warned = { attacker: "uid:22", state: "warned" as const, note: "", expected: null };
    const once = { ...warned, requestId: randomUUID() };
    expect(await setFollowUp(db, ana, once, NOW)).toBe("ok");
    expect(await setFollowUp(db, ana, once, NOW)).toBe("ok");
    expect(await listFollowUps(db, ana.workspaceId)).toHaveLength(1);
    // That card saw no step yet, so its step is a conflict; after a refresh it names Ana's and goes in.
    const stale = { ...warned, state: "resolved" as const, requestId: randomUUID() };
    expect(await setFollowUp(db, wren, stale, NOW)).toBe("conflict");
    const fresh = { ...stale, requestId: randomUUID(), expected: await latest(wren) };
    expect(await setFollowUp(db, wren, fresh, NOW)).toBe("ok");
  });
});

describe("our server from a screenshot (D97 amended 2026-11-19)", () => {
  it("is inferred only for the current name and the same tag, never a tagless or other-case match", async () => {
    const ogs = await signedIn("ogs");
    const theft = (tag: string, at: string) =>
      ({ kind: "theft", tag, name: "Gremlin", at, raw: "" }) as const;
    const entries = [
      theft("NSE", "11-15 13:46"),
      theft("", "11-15 12:10"),
      theft("nse", "11-15 11:00"),
    ];
    const draft = { victimUid: 11, readAt: NOW, entries };
    expect(await saveSecretOpsDraft(db, ogs, draft, CLOCK)).toMatchObject({ saved: 3 });
    const stored = await listThefts(db, ogs.workspaceId);
    // All three are Gremlin of NSE by uid; only the exact one says "our server".
    expect(stored.map((r) => [r.attackerKey, r.rosterExact])).toEqual([
      ["uid:22", true],
      ["uid:22", false],
      ["uid:22", false],
    ]);
  });

  it("links a tracked alliance only when the tag is the same, case and all", async () => {
    const ogs = await signedIn("ogs");
    const lower = { ...typed({ name: "Bramblewick", tag: "nse" }, 11), requestId: randomUUID() };
    expect(await addTheft(db, ogs, lower, CLOCK)).toBe("ok");
    const set = { attacker: "name:bramblewick", server: 325 };
    expect(await setServer(db, ogs, set, NOW)).toBe("ok");
    const [group] = (await theftsView(db, ogs, CLOCK)).groups;
    expect([group?.tag, group?.attackers[0]?.server, group?.contact]).toEqual(["nse", 325, null]);
  });
});
