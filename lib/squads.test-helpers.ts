// Test-only: a /v1/players answer as fetchPlayer returns it (D117, D132), with invented values.
import {
  NotFoundError,
  QuotaExhaustedError,
  UpstreamError,
  type PlayerSquadsInput,
  type Quota,
  type SquadInput,
} from "./sources/types";

/** What fetchPlayer throws for an HTTP status, as lib/sources/v1.ts maps it: 404, 429, or any other. */
export const playerFailure = (status: number): Error =>
  status === 404
    ? new NotFoundError("404 on /players")
    : status === 429
      ? new QuotaExhaustedError("429 on /players")
      : new UpstreamError(status);

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
