// The 20 alliances tracked on server 325, addressed by union_id (plan §3.4): tags are
// case-sensitive and not unique, ids never change. Seeded from the alliance_power board
// (2026-11-03 16:35 UTC); every entry verified on GET /v1/alliances/{id} on 2026-11-04
// (fixtures/v1-ids/<id>.json, fixtures/v1-*/alliance-<id>.json). Names are stored as the
// API returns them and rendered as text.
// Comments: board power rank · board kills rank · /v1 rank.rank at verification.
// To change the list: edit here, redeploy. A change mid-Saturday does not affect the
// running event, which uses its own copy (events.alliance_ids).

export const SERVER = 325;

export type TrackedAlliance = {
  unionId: number;
  tag: string;
  name: string;
  /** Unused in v1: names from before tracking began are not reconstructed (§3.8). */
  formerly?: { tag: string; name: string }[];
};

export const ALLIANCES = [
  { unionId: 67109944, tag: "NSE", name: "Natural Selection" }, // #1 · #1 · v1 #1
  { unionId: 67110320, tag: "URSA", name: "Ursus Invictus" }, // #2 · #4 · v1 #4 (was "Wolves" before tracking began)
  { unionId: 67111155, tag: "OGs", name: "OldGrandmas" }, // #3 · #2 · v1 #2
  { unionId: 67110584, tag: "TmS", name: "TheMightySpartans" }, // #4 · #3 · v1 #3
  { unionId: 67110992, tag: "WACK", name: "TheWackyOnes" }, // #5 · #5 · v1 #5
  { unionId: 67110335, tag: "YAHO", name: "AGGRESSOR" }, // #6 · #6 · v1 #6
  { unionId: 67117338, tag: "FSPN", name: "Slapsticks" }, // #7 · #8 · v1 #7
  { unionId: 67110927, tag: "RDK", name: "Ritter-der-Kokusnuss" }, // #8 · #13 · v1 #9
  { unionId: 67110958, tag: "TRI", name: "TRIUMPHANTS" }, // #9 · #11 · v1 #8
  { unionId: 67116075, tag: "TEST", name: "Test-Tickles" }, // #10 · #7 · v1 #10
  { unionId: 67111657, tag: "HSR", name: "Harmonie San. & Reha" }, // #11 · #10 · v1 #11
  { unionId: 67110067, tag: "PSY", name: "Psycho Killers" }, // #12 · #16 · v1 #13
  { unionId: 67110079, tag: "IMPA", name: "IMPERIUM AETERNUM" }, // #13 · #9 · v1 #12
  { unionId: 67111313, tag: "BRAV", name: "꧁Black Raven꧂" }, // #14 · #14 · v1 #15 (decorative glyphs are part of the name)
  { unionId: 67112691, tag: "NDA", name: "NoDiscord" }, // #15 · #12 · v1 #14
  { unionId: 67110465, tag: "BOH", name: "BladesOfHonor" }, // #16 · #26 · v1 #16
  { unionId: 67110415, tag: "CR8R", name: "BCR8RNU" }, // #17 · #18 · v1 #17
  { unionId: 67110999, tag: "WOK", name: "Wolfskinder" }, // #18 · #24 · v1 #18
  { unionId: 67110063, tag: "TRM", name: "Thermopylae" }, // #19 · #19 · v1 #31 (47 members, 0.77B on 2026-11-04 — owner may swap it)
  { unionId: 67110811, tag: "404", name: "Берсерк" }, // #20 · #25 · v1 #21 (Cyrillic name)
] as const satisfies readonly TrackedAlliance[];
