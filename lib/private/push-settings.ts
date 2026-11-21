// Alliance settings → Notifications (D148): each officer turns browser notifications on for their own device,
// for the uses they pick, and off again. Officers only; the workspace and the person come from the session,
// so a device is only ever saved, changed or deleted as the signed-in officer's own. The subscription is
// checked at this boundary (a known push service, keys of the right size) and stored sealed. Without the
// site's push keys there is no card and every write answers `turned_off`.
import { z } from "zod";

import type { Db } from "../db";
import type { Env } from "../env";
import { endpointHash, pushConfig, sealDevice } from "../push";
import { recordFailure } from "../repo/auth-attempts";
import { deleteDevice, officerDevices, saveDevice, setDevice, trimDevices } from "../repo/push";
import { PUSH_USES, type PushUse } from "../schema-push";
import { pushHost } from "../web-push";
import type { WorkspaceAccess } from "./access";
import { WORKSPACE_LANGUAGES } from "./dictionary";
import { featureOn } from "./features";

/** At most this many writes per 15 minutes per officer: far above a person flipping switches. */
const WRITES = 30;
const WINDOW_MS = 15 * 60_000;
/** An officer's devices in one workspace; a new one past this replaces the oldest. */
export const DEVICES_MAX = 10;

/** Each use's D134 switch: a use whose feature is off is not offered. The night read has none. */
const SWITCH: Partial<Record<PushUse, "shield_check" | "board" | "roll_call">> = {
  shield: "shield_check",
  claim: "board",
  roll_call: "roll_call",
};

/** The uses this workspace offers now, in the card's order. */
export const usesOffered = (access: WorkspaceAccess): PushUse[] =>
  PUSH_USES.filter((u) => {
    const feature = SWITCH[u];
    return !feature || featureOn(access, feature);
  });

const endpoint = z.string().max(1024).refine(pushHost);
const uses = z.array(z.enum(PUSH_USES)).max(PUSH_USES.length);
const language = z.enum(WORKSPACE_LANGUAGES);

export const pushInput = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("subscribe"),
      subscription: z
        .object({
          endpoint,
          // The browser's P-256 public key (65 bytes) and its 16-byte auth secret, base64url.
          keys: z
            .object({
              p256dh: z.string().regex(/^B[A-Za-z0-9_-]{86}$/),
              auth: z.string().regex(/^[A-Za-z0-9_-]{22}$/),
            })
            .strict(),
        })
        .strict(),
      uses,
      language,
    })
    .strict(),
  z.object({ action: z.literal("uses"), endpoint, uses, language }).strict(),
  z.object({ action: z.literal("unsubscribe"), endpoint }).strict(),
  // The desk's language switched on this device: its notifications follow.
  z.object({ action: z.literal("language"), endpoint, language }).strict(),
]);
export type PushInput = z.infer<typeof pushInput>;

export interface PushView {
  /** The site's VAPID public key: the browser's `applicationServerKey`. Public by design. */
  publicKey: string;
  offered: PushUse[];
  /** The officer's own devices: an endpoint's sha256 and the uses it is on for. */
  devices: { hash: string; uses: PushUse[] }[];
}

/** The card's view, or null when the site has no push keys (the card is not shown). */
export async function pushView(
  db: Db,
  access: WorkspaceAccess,
  env: Env,
): Promise<PushView | null> {
  const config = pushConfig(env);
  if (!config) return null;
  const rows = await officerDevices(db, access.workspaceId, access.user.id);
  return {
    publicKey: config.publicKey,
    offered: usesOffered(access),
    devices: rows.map((r) => ({ hash: r.endpointHash, uses: r.uses })),
  };
}

export async function savePush(
  db: Db,
  access: WorkspaceAccess,
  input: PushInput,
  env: Env,
  now: Date,
): Promise<{ ok: true } | { ok: false; code: "turned_off" | "rate_limited" | "not_found" }> {
  const config = pushConfig(env);
  if (!config) return { ok: false, code: "turned_off" };
  const tries = await recordFailure(db, `push:user:${access.user.id}`, WINDOW_MS, now);
  if (tries > WRITES) return { ok: false, code: "rate_limited" };
  const own = { workspaceId: access.workspaceId, userId: access.user.id };
  const offered = usesOffered(access);
  const picked = (list: PushUse[]) => offered.filter((u) => list.includes(u));
  if (input.action === "unsubscribe") {
    await deleteDevice(db, { ...own, endpointHash: endpointHash(input.endpoint) });
    return { ok: true };
  }
  if (input.action === "uses" || input.action === "language") {
    const key = { ...own, endpointHash: endpointHash(input.endpoint) };
    const uses = input.action === "uses" ? { uses: picked(input.uses) } : {};
    const done = await setDevice(db, key, { ...uses, language: input.language });
    return done ? { ok: true } : { ok: false, code: "not_found" };
  }
  const sub = input.subscription;
  await saveDevice(db, {
    workspaceId: access.workspaceId,
    workspaceUserId: access.user.id,
    endpointHash: endpointHash(sub.endpoint),
    ...sealDevice(config.secret, access.workspaceId, sub),
    uses: picked(input.uses),
    language: input.language,
    createdAt: now,
  });
  await trimDevices(db, access.workspaceId, access.user.id, DEVICES_MAX);
  return { ok: true };
}
