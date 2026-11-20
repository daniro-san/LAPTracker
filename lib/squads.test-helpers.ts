// Test-only: a /v1/players answer as fetchPlayer returns it (D117, D132), with invented values.
import type { PlayerSquadsInput, Quota, SquadInput } from "./sources/types";

const NO_FACTS: PlayerSquadsInput["facts"] = {
  shielding: null,
  shieldType: null,
  mapUpdatedAt: null,
  lastSeenAt: null,
  language: null,
  power: null,
  kills: null,
  unionId: null,
  sid: null,
  homeSid: null,
  vip: null,
};

/** An answer with these squads and quota, no facts, no history, and a body holding only the uid. */
export const playerAnswer = (
  uid: number,
  squads: SquadInput[] = [],
  quota: Quota | null = null,
  more: Partial<PlayerSquadsInput> = {},
): PlayerSquadsInput => ({
  uid,
  squads,
  quota,
  facts: NO_FACTS,
  history: [],
  raw: { uid },
  roster: null,
  ...more,
});
