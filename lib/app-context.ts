// What a route handler needs from the outside world, in one place. The real one reads the env,
// the clock, the adapters and Neon; route tests replace this module (vi.mock) with fakes and PGlite.
import { groqChat, type ChatModel, type Generation } from "./ai/groq";
import { captureServer } from "./analytics/server";
import { openDb, type Db } from "./db";
import { getEnv, type Env } from "./env";
import { nextEventCache, type EventCache } from "./event-cache";
import { internal, v1 } from "./sources";
import type { InternalSource, V1Source } from "./sources/types";

export interface AppContext {
  env: Env;
  now: () => Date;
  v1: V1Source;
  internal: InternalSource;
  /** For Discord webhooks. */
  fetch: typeof fetch;
  openDb: () => { db: Db; close: () => Promise<void> };
  /** The event page's shared cache; a write that changes an event invalidates it (issue 327). */
  eventCache: EventCache;
  /** The notices' Translate and Improve writing (D81); null without GROQ_API_KEY. */
  ai: ChatModel | null;
}

/** Each Groq request's metadata to PostHog (D115): one trace id per completion, no text, no key. */
const observeAi =
  (env: Env, send: typeof fetch) =>
  (generations: Generation[]): Promise<void> => {
    const traceId = crypto.randomUUID();
    return captureServer(
      env,
      send,
      generations.map((g) => ({ event: "$ai_generation", properties: { ...g, traceId } })),
    );
  };

export function getAppContext(): AppContext {
  const env = getEnv();
  const send: typeof fetch = (input, init) => fetch(input, init);
  return {
    env,
    now: () => new Date(),
    v1,
    internal,
    fetch: send,
    openDb: () => openDb(),
    eventCache: nextEventCache,
    ai: env.GROQ_API_KEY ? groqChat(env.GROQ_API_KEY, send, undefined, observeAi(env, send)) : null,
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
    ...Object.values(env.WORKSPACE_DISCORD_WEBHOOKS ?? {}).flatMap((w) =>
      [w.members?.url, w.leaders?.url].filter((u) => u !== undefined),
    ),
  ].filter((s): s is string => s !== undefined);
}
