// Scrubs secrets from anything headed for run_logs, app_errors, console or Discord (plan §12.2, §12.5).
// lib/logger.ts passes every `data` object through redact(); it must stay dependency-free.

export const REDACTED = "[redacted]";

const SECRET_KEYS = new Set(["authorization", "x-edit-pin", "cookie", "set-cookie", "x-api-key"]);
const LAP_KEY_PATTERN = /lap_[A-Za-z0-9_-]{8,}/g;
const MIN_SECRET_LENGTH = 6; // EDIT_PIN is 6-8 digits; shorter values would mask ordinary numbers.

function scrubString(value: string, secrets: readonly string[]): string {
  let out = value.replace(LAP_KEY_PATTERN, REDACTED);
  for (const secret of secrets) {
    if (secret.length >= MIN_SECRET_LENGTH) out = out.split(secret).join(REDACTED);
  }
  return out;
}

/**
 * Returns a deep copy of `value` with secret-named keys masked, known secret values replaced
 * wherever they appear inside strings, and anything shaped like a LAP key removed.
 */
export function redact(value: unknown, secrets: readonly string[] = []): unknown {
  if (typeof value === "string") return scrubString(value, secrets);
  if (Array.isArray(value)) return value.map((item) => redact(item, secrets));
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, v]) => [
        key,
        SECRET_KEYS.has(key.toLowerCase()) ? REDACTED : redact(v, secrets),
      ]),
    );
  }
  return value;
}
