// What a route handler needs from the outside world, in one place. The real one reads the env,
// the clock, the adapters and Neon; route tests replace this module (vi.mock) with fakes and PGlite.
import { openDb, type Db } from "./db";
import { getEnv, type Env } from "./env";
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
}

export function getAppContext(): AppContext {
  return {
    env: getEnv(),
    now: () => new Date(),
    v1,
    internal,
    fetch: (input, init) => fetch(input, init),
    openDb: () => openDb(),
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
  ].filter((s): s is string => s !== undefined);
}
