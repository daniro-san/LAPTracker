// What a route handler needs from the outside world, in one place. The real one reads the env,
// the clock, the adapters and Neon; route tests replace this module (vi.mock) with fakes and PGlite.
import { groqChat, type ChatModel, type Generation } from "./ai/groq";
import { captureServer, type EventWorkspace } from "./analytics/server";
import { openDb, type Db, type PoolSize } from "./db";
import { getEnv, type Env } from "./env";
import { nextEventCache, type EventCache } from "./event-cache";
import { nextPublicCache, type PublicCache } from "./public-cache";
import { internal, v1 } from "./sources";
import type { InternalSource, V1Source } from "./sources/types";
import { nextWakeCache, type WakeCache } from "./wake-cache";

export interface AppContext {
  env: Env;
  now: () => Date;
  v1: V1Source;
  internal: InternalSource;
  /** For Discord webhooks. */
  fetch: typeof fetch;
  /** `size` for a page's Pools (lib/page.ts); the driver's defaults otherwise. */
  openDb: (size?: PoolSize) => { db: Db; close: () => Promise<void> };
  /** The event page's shared cache; a write that changes an event invalidates it (issue 327). */
  eventCache: EventCache;
  /** The public pages' shared reads (D143); every write to a table they read invalidates it. */
  publicCache: PublicCache;
  /** What the tick knows without the database between calls (D141). */
  wakeCache: WakeCache;
  /**
   * The notices' Translate and Improve writing (D81), for the workspace that asks (issue 452: its slug and
   * tag go on each `$ai_generation`; null when a Discord server's workspace is gone); null without GROQ_API_KEY.
   */
  ai: ((where: EventWorkspace | null) => ChatModel) | null;
}

/** Each Groq request's metadata to PostHog (D115): one trace id per completion, no text, no key. */
const observeAi =
  (env: Env, send: typeof fetch, where: EventWorkspace | null) =>
  (generations: Generation[]): Promise<void> => {
    const traceId = crypto.randomUUID();
    return captureServer(
      env,
      send,
      generations.map((g) => ({
        event: "$ai_generation",
        properties: { ...g, traceId },
        ...(where && { where }),
      })),
    );
  };

export function getAppContext(): AppContext {
  const env = getEnv();
  const send: typeof fetch = (input, init) => fetch(input, init);
  const groqKey = env.GROQ_API_KEY;
  return {
    env,
    now: () => new Date(),
    v1,
    internal,
    fetch: send,
    openDb: (size) => openDb(undefined, size),
    eventCache: nextEventCache,
    publicCache: nextPublicCache,
    wakeCache: nextWakeCache,
    ai: groqKey ? (where) => groqChat(groqKey, send, undefined, observeAi(env, send, where)) : null,
  };
}

/** Every value the logger and messages must never carry (plan §12.2). */
export function secretsOf(env: Env): string[] {
  return [
    env.DATABASE_URL,
    env.CRON_SECRET,
    env.EDIT_PIN,
    env.LAP_API_KEY,
    env.NOTIFY_WEBHOOK_PUBLIC,
    env.NOTIFY_WEBHOOK_ADMIN,
    env.DISCORD_CLIENT_SECRET,
    env.DISCORD_BOT_TOKEN,
    env.GROQ_API_KEY,
    env.WORKSPACE_KEYS_SECRET,
    env.VAPID_PRIVATE_KEY,
    ...Object.values(env.WORKSPACE_DISCORD_WEBHOOKS ?? {}).flatMap((w) =>
      [w.members?.url, w.leaders?.url].filter((u) => u !== undefined),
    ),
  ].filter((s): s is string => s !== undefined);
}
