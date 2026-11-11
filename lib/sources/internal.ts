// The site's internal API (plan §2b, §3.5): UNOFFICIAL and READ-ONLY. Two uses only, recorded in
// docs/decisions/: the ranks board (a cross-check, never in a delta) and the live: true roster as a
// per-alliance fallback when /v1 fails. The site's refresh endpoint answers 403 "Refresh only from the
// site": the maintainer closed it on purpose. This file has no refresh function and must never get
// one, and it never sends Origin, Referer or cookies. GET only.
import { z } from "zod";

import { getSourceEnv } from "../env";
import { readBody, rosterFields, TIMEOUT_MS, toSnapshotInput, USER_AGENT } from "./shared";
import {
  type AllianceSnapshotInput,
  NotFoundError,
  NotLiveError,
  type RanksBoard,
  SchemaError,
  type UnionId,
  UpstreamError,
} from "./types";

// Two shapes (plan §2b): a real roster when someone viewed it on the site, else a stub from the map crawl.
const allianceSchema = z.discriminatedUnion("live", [
  z.object({ live: z.literal(false) }),
  z.object({ live: z.literal(true), ...rosterFields }),
]);

const boardSchema = z.object({
  slug: z.string(),
  pulled_at: z.number(),
  rows: z.array(z.object({ id: z.number().int(), score: z.string().regex(/^\d+$/) })),
});
const ranksSchema = z.object({ boards: z.array(boardSchema) });

async function get(path: string): Promise<Response> {
  const response = await fetch(`${getSourceEnv().LAP_SITE_BASE_URL}${path}`, {
    method: "GET",
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  // Branch on status only (plan §11.4). No retries: the collector decides what a failure means.
  const { status } = response;
  if (status >= 200 && status < 300) return response;
  await response.body?.cancel();
  if (status === 404) throw new NotFoundError(`404 on ${path}`);
  throw new UpstreamError(status);
}

export async function fetchAlliance(id: UnionId): Promise<AllianceSnapshotInput> {
  const { data, raw } = await readBody(
    await get(`/alliances/${id}`),
    allianceSchema,
    "internal.schema",
  );
  // INVARIANT internal-stub-never-used (plan §3.5)
  if (!data.live) throw new NotLiveError(`alliance ${id} is the live: false stub`);
  return toSnapshotInput(data, { cached: null, quota: null, raw });
}

export async function fetchRanks(server: number): Promise<RanksBoard> {
  const response = await get(`/servers/catalog/${server}/ranks`);
  const { data } = await readBody(response, ranksSchema, "internal.schema");
  const power = data.boards.find((b) => b.slug === "alliance_power");
  const kills = data.boards.find((b) => b.slug === "alliance_kills");
  if (!power || !kills)
    throw new SchemaError("internal.schema", ["boards.alliance_power|alliance_kills"]);
  const toMap = (board: z.infer<typeof boardSchema>) =>
    new Map(board.rows.map((row) => [row.id, Number(row.score)]));
  return {
    pulledAt: new Date(Math.min(power.pulled_at, kills.pulled_at) * 1000),
    power: toMap(power),
    kills: toMap(kills),
  };
}
