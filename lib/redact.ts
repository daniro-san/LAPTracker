// Scrubs secrets and private roster values from anything headed for run_logs, app_errors, console or
// Discord (plan §12.2, §12.5; D115's 2026-11-21 amendment). lib/logger.ts passes every `data` object through
// redact(); it must stay dependency-free: its one import, lib/queries/blocked-keys.ts, imports nothing.
import { BLOCKED_ROSTER_KEYS, PHOTO_HOST } from "./queries/blocked-keys";

export const REDACTED = "[redacted]";
/** What a private roster field's value becomes in error text. */
export const PRIVATE_VALUE = "…";

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const camel = (key: string) => key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
/**
 * The private keys as error text names them: each of BLOCKED_ROSTER_KEYS in snake_case and camelCase
 * (lib/private's rows say `lastOnlineAt`), in any case. Our own `daily_read` and `daily_rosters` are not keys.
 */
const KEY = `(?:${[...new Set(BLOCKED_ROSTER_KEYS.flatMap((k) => [k, camel(k)]))]
  .sort((a, b) => b.length - a.length)
  .map(escape)
  .join("|")})`;
const IS_KEY = new RegExp(`^${KEY}$`, "i");
/** Quoted text up to this long is one value; past it a quote has no end (keeps every match linear). */
const Q = "{0,500}";
/**
 * One value: an (escaped) quoted string, a short array, or a bare run up to a delimiter (a number, true,
 * an ISO time, a URL); never a SQL placeholder (`= $1`). Quoted forms are bounded, so a quote with no end
 * costs at most Q characters at each key; an escaped string's text holds no backslash, so its closing `\"`
 * never rescans a run of them.
 */
const VALUE =
  `(?!\\$\\d)(?:\\\\+"[^"\\\\\\n]${Q}\\\\+"|"(?:[^"\\\\\\n]|\\\\.)${Q}"|'[^'\\n]${Q}'|` +
  `\`[^\`\\n]${Q}\`|\\[[^\\]\\n]${Q}\\]|[^\\s,;&)}\\]"'\`<>\\\\]+)`;
/** `"x":123`, `\"x\":123`, `x=123`, `X: 123`, `members.3.x: 123`; never `max: 3` or `is_online=1`. */
const KEY_VALUE = new RegExp(`(?<![\\w$])(${KEY})(\\\\*["'\`]?\\s*[:=]\\s*)${VALUE}`, "gi");
/** The text between braces: one Zod issue, or the rest of a union's issue after its nested `errors`. */
const ZOD_SEGMENT = /[^{}]+/g;
// Each starts at the first backslash of a run and reads a bounded path, so a backslash run or an unclosed
// `"path":[` costs one pass.
const ZOD_PATH = /(?<!\\)\\*"path\\*"\s*:\s*\[([^\]]{0,500})\]/;
const ZOD_ECHO = new RegExp(`(?<!\\\\)(\\\\*"(?:input|received)\\\\*"\\s*:\\s*)${VALUE}`, "g");
/** Postgres' detail line: `Key (union_id, x)=(5, 123) already exists.` */
const PG_KEY = /Key \(([^()]*)\)=\(([^()]*)\)/g;
/**
 * Drizzle's `Failed query: … \nparams: …`: the parameters are the row (names, an officer's text, raw_json), so
 * everything from `params:` on goes. The query text says what failed.
 */
const QUERY_PARAMS = /(^|\n)params:[^]*$/;
const PHOTO_HOST_TEXT = new RegExp(escape(PHOTO_HOST), "gi");
/** Before the host: a subdomain's labels, then `//` and a scheme. After it: up to a delimiter. */
const LABEL_CHAR = /[\w.-]/;
const SCHEME_CHAR = /[a-z\d+.-]/i;
const URL_END = /[\s"'`<>,;)\]}\\]/;

const isPrivateKey = (name: string) =>
  IS_KEY.test(
    name
      .replace(/\\[nrt]/g, " ")
      .trim()
      .replace(/^[\\"'`]+|[\\"'`]+$/g, ""),
  );

/** Postgres names its columns and values in order; when the counts differ, every value goes. */
function pgKey(all: string, columns: string, values: string): string {
  const cols = columns.split(/,\s*/);
  if (!cols.some(isPrivateKey)) return all;
  const vals = values.split(/,\s*/);
  const kept =
    vals.length === cols.length
      ? vals.map((v, i) => (isPrivateKey(cols[i] ?? "") ? PRIVATE_VALUE : v)).join(", ")
      : PRIVATE_VALUE;
  return `Key (${columns})=(${kept})`;
}

function zodIssue(issue: string): string {
  const last = ZOD_PATH.exec(issue)?.[1]?.split(",").at(-1);
  return last && isPrivateKey(last) ? issue.replace(ZOD_ECHO, `$1${PRIVATE_VALUE}`) : issue;
}

/**
 * Every URL on the photo host or a subdomain of it, scheme or not, as `…`. Found by the host's text and
 * widened by hand, so each character is looked at a bounded number of times (a regex with a leading
 * `(?:label\.)*` was quadratic on long text).
 */
function photoUrls(text: string): string {
  let out = "";
  let from = 0;
  for (const hit of text.matchAll(PHOTO_HOST_TEXT)) {
    if (hit.index < from) continue;
    let end = hit.index + hit[0].length;
    while (end < text.length && !URL_END.test(text[end] ?? "")) end++;
    out += text.slice(from, urlStart(text, hit.index, from)) + PRIVATE_VALUE;
    from = end;
  }
  return out + text.slice(from);
}

/** Where the URL around a host found at `at` starts: its subdomains, `//` and scheme, never before `from`. */
function urlStart(text: string, at: number, from: number): number {
  let start = at;
  while (start > from && LABEL_CHAR.test(text[start - 1] ?? "")) start--;
  if (start - 2 < from || !text.startsWith("//", start - 2)) return start;
  start -= 2;
  let scheme = start - 1;
  while (scheme > from && SCHEME_CHAR.test(text[scheme - 1] ?? "")) scheme--;
  return text[start - 1] === ":" && scheme < start - 1 ? scheme : start;
}

/**
 * `text` with the value of every private roster field it names replaced by `…` (CLAUDE.md, D71, D115's
 * 2026-11-21 amendment): JSON and escaped JSON, `key=value`, `key: value`, a Zod issue's echoed input when its
 * path ends in a private key, a Postgres `Key (…)=(…)` line, and a photo URL anywhere. A query's parameters
 * go whole. Everything else stays, so the text still says what broke.
 */
export function redactPrivate(text: string): string {
  return photoUrls(text.replace(QUERY_PARAMS, `$1params: ${PRIVATE_VALUE}`))
    .replace(PG_KEY, pgKey)
    .replace(ZOD_SEGMENT, zodIssue)
    .replace(KEY_VALUE, `$1$2${PRIVATE_VALUE}`);
}

const SECRET_KEYS = new Set(["authorization", "x-edit-pin", "cookie", "set-cookie", "x-api-key"]);
const LAP_KEY_PATTERN = /lap_[A-Za-z0-9_-]{8,}/g;
// A database URL carries its password; a driver error can quote one that is not the configured value.
const DB_URL_PATTERN = /postgres(?:ql)?:\/\/[^\s"'`]+/g;
const MIN_SECRET_LENGTH = 6; // EDIT_PIN is 6+ characters (D3); shorter values would mask ordinary words.

function scrubString(value: string, secrets: readonly string[]): string {
  let out = redactPrivate(value)
    .replace(LAP_KEY_PATTERN, REDACTED)
    .replace(DB_URL_PATTERN, REDACTED);
  for (const secret of secrets) {
    if (secret.length >= MIN_SECRET_LENGTH) out = out.split(secret).join(REDACTED);
  }
  return out;
}

/**
 * Returns a deep copy of `value` with secret-named keys masked, private roster keys' values as `…`, known
 * secret values replaced wherever they appear inside strings, anything shaped like a LAP key removed, and
 * every string passed through redactPrivate.
 */
export function redact(value: unknown, secrets: readonly string[] = []): unknown {
  if (typeof value === "string") return scrubString(value, secrets);
  if (Array.isArray(value)) return value.map((item) => redact(item, secrets));
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, v]) => [
        key,
        SECRET_KEYS.has(key.toLowerCase())
          ? REDACTED
          : isPrivateKey(key)
            ? PRIVATE_VALUE
            : redact(v, secrets),
      ]),
    );
  }
  return value;
}
