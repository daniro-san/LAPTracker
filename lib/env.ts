// Validated environment (plan §11.2, §12.2). Parse once, fail fast with key names only — never values.
import { z } from "zod";

import { POSTHOG_UI_HOST } from "./analytics/region";

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "expected HH:MM");
const optional = <T extends z.ZodType>(schema: T) => schema.optional();

export const isTimeZone = (tz: string): boolean => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

const discordWebhook = z
  .string()
  .regex(/^https:\/\/(discord|discordapp)\.com\/api\/webhooks\//, "expected a Discord webhook URL");

/** One notice channel (D102): its webhook (a secret), the name shown before posting, and whether it is a forum. */
const noticeChannel = z
  .object({
    url: discordWebhook,
    name: z.string().trim().min(1).max(100),
    forum: z.boolean().default(false),
  })
  .strict();

/**
 * Where each workspace posts notices (D102), by slug: a members notice to `members`, a leadership one to
 * `leaders`. JSON in one variable; the URLs are secrets, so a parse error names the path, never the value.
 */
const workspaceWebhooks = z
  .string()
  .transform((raw, ctx) => {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      ctx.addIssue({ code: "custom", message: "expected JSON" });
      return z.NEVER;
    }
  })
  .pipe(
    z.record(
      z.string().regex(/^[a-z0-9][a-z0-9-]{1,31}$/, "expected a workspace slug"),
      z.object({ members: noticeChannel.optional(), leaders: noticeChannel.optional() }).strict(),
    ),
  );

export const envSchema = z.object({
  LAP_API_KEY: z.string().startsWith("lap_", "expected a lap_ key"),
  // The only place upstream hosts appear (plan Phase 2); override if the host or version path moves.
  LAP_API_BASE_URL: z.url().default("https://api.lastasylumtracker.com/v1"),
  LAP_SITE_BASE_URL: z.url().default("https://lastasylumtracker.com/api"),
  DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, "expected a postgres:// URL"),
  CRON_SECRET: z.string().min(32, "expected 32+ characters"),
  // Any visible ASCII, no spaces (D3 amendment): digits, letters, or an `openssl rand -base64` value. It
  // travels in the x-edit-pin header, so it stays ASCII; 6 is the minimum the limiter math assumes.
  EDIT_PIN: z
    .string()
    .regex(/^[\x21-\x7E]{6,64}$/, "expected 6-64 visible ASCII characters, no spaces"),
  SERVER_TZ: z.string().refine(isTimeZone, "expected an IANA time zone"),
  EVENT_WEEKDAY: z.coerce.number().int().min(0).max(6),
  EVENT_TIME: hhmm,
  SNAPSHOT_BEFORE: hhmm,
  SNAPSHOT_AFTER: hhmm,
  SNAPSHOT_WINDOW_MIN: z.coerce.number().int().min(1).max(240),
  QUOTA_CHECK_AT: z
    .string()
    .regex(/^(mon|tue|wed|thu|fri|sat|sun) ([01]\d|2[0-3]):[0-5]\d$/, "expected e.g. 'fri 20:00'"),
  // Weekly automatic rehearsals (plan §3.1): "fri 18:00" or "wed 18:00, fri 18:00"; empty = off.
  REHEARSAL_AT: z
    .string()
    .regex(
      /^((mon|tue|wed|thu|fri|sat|sun) ([01]\d|2[0-3]):[0-5]\d)?(\s*,\s*(mon|tue|wed|thu|fri|sat|sun) ([01]\d|2[0-3]):[0-5]\d)*$/,
      "expected e.g. 'fri 18:00' or 'wed 18:00, fri 18:00', or empty",
    )
    .default("fri 18:00"),
  REHEARSAL_KEEP: z.coerce.number().int().min(1).max(50).default(4),
  // Minutes between an event's samples (D69), on a grid from the hour (15: :00, :15, :30, :45); 0 = off.
  SAMPLE_EVERY_MIN: z.coerce
    .number()
    .int()
    .min(0)
    .max(60)
    .refine((n) => n === 0 || 60 % n === 0, "expected 0 or a divisor of 60")
    .default(15),
  // The daily roster read for member history (D60), server time, every day. 23:30: the 23:37 tick reads
  // the day's counters (daily_tech) before the 00:00 reset, and the 23:52 tick re-reads the alliances
  // that fell short (D72).
  DAILY_ROSTER_AT: hhmm.default("23:30"),
  NOTIFY_WEBHOOK_PUBLIC: optional(discordWebhook),
  NOTIFY_WEBHOOK_ADMIN: optional(discordWebhook),
  NOTIFY_ADMIN_MENTION: optional(
    z.string().regex(/^(role:)?\d{17,20}$/, "expected <id> or role:<id>"),
  ),
  LAP_LIVE_TEST: optional(z.enum(["0", "1"])),
  // The workspace's Discord sign-in (D71). Optional: without them the app starts and /w/[slug] says
  // sign-in is not set up. The base URL is overridable so tests and the local e2e reach a stub (D73).
  DISCORD_CLIENT_ID: optional(z.string().regex(/^\d{17,20}$/, "expected a Discord application id")),
  DISCORD_CLIENT_SECRET: optional(z.string().min(16, "expected 16+ characters")),
  DISCORD_API_BASE_URL: z.url().default("https://discord.com/api"),
  // The Discord app's Public Key (D96): verifies "Send to LAPTracker" interactions. Not a secret. Without
  // it the interactions route refuses every request.
  DISCORD_PUBLIC_KEY: optional(z.string().regex(/^[0-9a-f]{64}$/i, "expected 64 hex characters")),
  // The Discord app's bot token (D101): only opens a thread on a message and posts "Translate for everyone"
  // in it. A secret, sent only to Discord as `Authorization: Bot …`. Without it translations go to the channel.
  DISCORD_BOT_TOKEN: optional(z.string().min(20, "expected a Discord bot token")),
  // PostHog (D77): on only on the production deployment (Vercel sets VERCEL_ENV) with the project key set.
  // The feature flags (D91) are read wherever the key is set.
  VERCEL_ENV: optional(z.string()),
  POSTHOG_KEY: optional(z.string()),
  // Feature flags turned on without PostHog (D91): comma-separated flag keys, read only when POSTHOG_KEY is
  // not set (local `next dev`, reviews). Never set it on Vercel.
  LOCAL_FLAGS: optional(z.string()),
  // PostHog Endpoints (D145): a personal API key with read-only query scope on project 741657. A secret,
  // server only, sent only to PostHog. Optional: without it the usage numbers on /admin and the desk are not
  // drawn. Not POSTHOG_PERSONAL_API_KEY, which is for the source-map upload only (D115).
  POSTHOG_QUERY_API_KEY: optional(
    z.string().startsWith("phx_", "expected a phx_ personal API key"),
  ),
  // Where the Endpoints are run: PostHog's US app (D77). Overridable so the local e2e reaches a stub.
  POSTHOG_API_BASE_URL: z.url().default(POSTHOG_UI_HOST),
  // Translate and Improve writing in the notices library (D81). Optional: without it the buttons say
  // they are not set up, and nothing is sent anywhere.
  GROQ_API_KEY: optional(z.string().startsWith("gsk_", "expected a gsk_ key")),
  // "Publish to Discord" for notices (D102). Optional: without it, or without a workspace's channel, the
  // button says the channel is not set up and nothing is posted.
  WORKSPACE_DISCORD_WEBHOOKS: optional(workspaceWebhooks),
  // The master key that encrypts each workspace's own tracker key (D124): 32 bytes, base64 (`openssl rand
  // -base64 32`). A secret. Optional: without it no workspace key is saved or used, and only the own
  // alliance's workspace reads its squads, on LAP_API_KEY.
  WORKSPACE_KEYS_SECRET: optional(
    z.string().regex(/^[A-Za-z0-9+/]{43}=$/, "expected 32 bytes, base64 (openssl rand -base64 32)"),
  ),
  // Browser notifications for officers (D148): the site's VAPID key pair from `pnpm push:keys` (base64url:
  // the 65-byte public point, the 32-byte private scalar, a secret) and the contact push services may write
  // to. Optional: without all three (and WORKSPACE_KEYS_SECRET, which seals the subscriptions) the desk
  // shows no Notifications card and nothing is sent.
  VAPID_PUBLIC_KEY: optional(z.string().regex(/^B[A-Za-z0-9_-]{86}$/, "expected pnpm push:keys")),
  VAPID_PRIVATE_KEY: optional(z.string().regex(/^[A-Za-z0-9_-]{43}$/, "expected pnpm push:keys")),
  VAPID_SUBJECT: optional(
    z.string().regex(/^(mailto:\S+@\S+|https:\/\/\S+)$/, "expected mailto:… or https://…"),
  ),
});

export type Env = z.infer<typeof envSchema>;

/** Keys where an empty value is a setting ("off"), not "unset, use the default". */
const EMPTY_MEANS_OFF = new Set(["REHEARSAL_AT"]);

/** Empty strings count as unset, so `NOTIFY_WEBHOOK_PUBLIC=` in a .env file means "off". */
const withoutEmpty = (source: Record<string, string | undefined>) =>
  Object.fromEntries(
    Object.entries(source).filter(
      ([k, v]) => v !== undefined && (v !== "" || EMPTY_MEANS_OFF.has(k)),
    ),
  );

function parseWith<T extends z.ZodType>(
  schema: T,
  source: Record<string, string | undefined>,
): z.infer<T> {
  const result = schema.safeParse(withoutEmpty(source));
  if (!result.success) {
    const problems = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    throw new Error(`Invalid environment:\n  ${problems.join("\n  ")}`);
  }
  return result.data;
}

/**
 * The public placeholders of the committed template, .env.example (issue 592, D03 amendment). They mirror
 * that file, so anyone can read them; production refuses exactly these values and nothing else.
 */
const PUBLIC_PLACEHOLDERS = {
  CRON_SECRET: "local-placeholder-cron-secret-0123456789",
  EDIT_PIN: "000000",
} as const;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const env = parseWith(envSchema, source);
  if (source.NODE_ENV === "production" && source.VERCEL_ENV === "production") {
    const placeholders = (Object.keys(PUBLIC_PLACEHOLDERS) as (keyof typeof PUBLIC_PLACEHOLDERS)[])
      .filter((key) => env[key] === PUBLIC_PLACEHOLDERS[key])
      .map(
        (key) => `${key}: the public placeholder from .env.example is not allowed in production`,
      );
    if (placeholders.length > 0) {
      throw new Error(`Invalid environment:\n  ${placeholders.join("\n  ")}`);
    }
  }
  return env;
}

/** What lib/sources needs, so a source can run (live smoke test) without the database or schedule vars. */
const sourceEnvSchema = envSchema.pick({
  LAP_API_KEY: true,
  LAP_API_BASE_URL: true,
  LAP_SITE_BASE_URL: true,
});

export function getSourceEnv(): z.infer<typeof sourceEnvSchema> {
  return parseWith(sourceEnvSchema, process.env);
}

let cached: Env | undefined;

export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
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
