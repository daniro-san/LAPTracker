// Validated environment (plan §11.2, §12.2). Parse once, fail fast with key names only — never values.
import { z } from "zod";

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "expected HH:MM");
const optional = <T extends z.ZodType>(schema: T) => schema.optional();

const isTimeZone = (tz: string): boolean => {
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

export const envSchema = z.object({
  LAP_API_KEY: z.string().startsWith("lap_", "expected a lap_ key"),
  // The only place upstream hosts appear (plan Phase 2); override if the host or version path moves.
  LAP_API_BASE_URL: z.url().default("https://api.lastasylumtracker.com/v1"),
  LAP_SITE_BASE_URL: z.url().default("https://lastasylumtracker.com/api"),
  DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, "expected a postgres:// URL"),
  CRON_SECRET: z.string().min(32, "expected 32+ characters"),
  EDIT_PIN: z.string().regex(/^\d{6,8}$/, "expected 6-8 digits"),
  SERVER_TZ: z.string().refine(isTimeZone, "expected an IANA time zone"),
  EVENT_WEEKDAY: z.coerce.number().int().min(0).max(6),
  EVENT_TIME: hhmm,
  SNAPSHOT_BEFORE: hhmm,
  SNAPSHOT_AFTER: hhmm,
  SNAPSHOT_WINDOW_MIN: z.coerce.number().int().min(1).max(240),
  QUOTA_CHECK_AT: z
    .string()
    .regex(/^(mon|tue|wed|thu|fri|sat|sun) ([01]\d|2[0-3]):[0-5]\d$/, "expected e.g. 'fri 20:00'"),
  NOTIFY_WEBHOOK_PUBLIC: optional(discordWebhook),
  NOTIFY_WEBHOOK_ADMIN: optional(discordWebhook),
  NOTIFY_ADMIN_MENTION: optional(
    z.string().regex(/^(role:)?\d{17,20}$/, "expected <id> or role:<id>"),
  ),
  LAP_LIVE_TEST: optional(z.enum(["0", "1"])),
});

export type Env = z.infer<typeof envSchema>;

/** Empty strings count as unset, so `NOTIFY_WEBHOOK_PUBLIC=` in a .env file means "off". */
const withoutEmpty = (source: Record<string, string | undefined>) =>
  Object.fromEntries(Object.entries(source).filter(([, v]) => v !== undefined && v !== ""));

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

export function parseEnv(source: Record<string, string | undefined>): Env {
  return parseWith(envSchema, source);
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
