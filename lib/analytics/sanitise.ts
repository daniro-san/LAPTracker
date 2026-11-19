// PostHog's `before_send` (D77), pure so it can be tested without a browser. Every event leaves with:
// - no query string and no hash in any URL-like property, as D36 does for Vercel's scripts (`/players?q=<name>`
//   would carry a typed name), and none of the properties the SDK reads from a query string;
// - `area` (public, workspace or admin) and, on /w/<slug>, `workspace`, read from the event's own path, so an
//   event sent during a client-side navigation never carries the previous page's area; anywhere else, no
//   `workspace` or `alliance` (issue 452);
// - on /w/<slug> and /admin, `section`: the page's first segment from a closed list ("home" for the root,
//   `other` for anything else), so page views answer "which tabs are used" (D115);
// - exception messages scrubbed in every area (D115, replacing D77's "[masked]" on the workspace and /admin):
//   the type, the words and the stack frames stay; digit runs, emails, URLs' query strings and quoted text go.
//   Quoted text stays only where the engine quotes a built-in member: "(reading 'map')", never
//   "(reading 'Bramble')".
export type Area = "public" | "workspace" | "admin";

type Props = Record<string, unknown>;

/** The fields of a PostHog CaptureResult this module reads. */
export interface Captured {
  event: string;
  properties: Props;
  $set?: Props;
  $set_once?: Props;
}

/** The class the /w/[slug] and /admin layouts put around their pages: everything under it is masked in replay. */
export const MASK_CLASS = "ph-mask";

/**
 * Properties posthog-js 1.444.4 reads from a query string, whatever `save_campaign_params` says: its campaign
 * and click-id parameters (also as `$session_entry_…`), and `ph_keyword` from a search engine's referrer.
 */
const FROM_QUERY =
  /^(?:\$session_entry_|\$initial_)?(?:utm_\w+|gad_source|mc_cid|gclid|gclsrc|dclid|gbraid|wbraid|fbclid|msclkid|twclid|li_fat_id|igshid|ttclid|rdt_cid|epik|qclid|sccid|oppref|bfcid|irclid|_kx|ph_keyword)$/;
const URL_LIKE = /^(?:[a-z][a-z\d+.-]*:\/\/|\/)/i;
/** `href="…"` inside `$elements_chain`, which also matches `attr__href="…"`. */
const HREF_IN_CHAIN = /(href=")([^"?#]*)[^"]*"/g;
/** A URL or a path inside free text, such as an exception message. */
const URL_IN_TEXT = /((?:[a-z][a-z\d+.-]*:\/\/|\/)[^\s?#"'<>]*)[?#][^\s"'<>]*/gi;
const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
/**
 * Text between quotes, each closed by its own kind: "…", '…', `…`, ‘…’ or “…”. A quote with a letter or
 * digit on its outer side is an apostrophe (can't, it's, Ana’s), not a delimiter.
 */
const QUOTED = /(?<![\p{L}\p{N}_])(?:(["'`])([^]*?)\1|‘([^]*?)’|“([^]*?)”)(?![\p{L}\p{N}_])/gu;
/** A property path an engine quotes: map, a.b, a[0], a.b(). */
const CODE = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*|\[\d+\])*(?:\(\))?$/;
const CODE_BEFORE = /(?:reading|setting|evaluating) $/;
/**
 * Built-in members an engine names in "(reading 'map')": the only quoted words kept. Anything else in
 * quotes may be a name ("(reading 'Bramble')", a field keyed by a name), so it goes.
 */
const BUILT_IN = new Set(
  (
    "map filter find findIndex forEach reduce some every includes indexOf length push pop shift " +
    "unshift slice splice sort concat join split trim replace replaceAll toString toLowerCase " +
    "toUpperCase toFixed toISOString getTime localeCompare startsWith endsWith padStart at flat " +
    "flatMap then catch finally keys values entries get set has add delete size call apply bind " +
    "name id type value current children props style focus blur close showModal randomUUID " +
    "getRandomValues clipboard writeText json text status ok headers body data target " +
    "addEventListener removeEventListener querySelector closest contains getBoundingClientRect " +
    "scrollIntoView preventDefault stopPropagation parentNode documentElement crypto navigator " +
    "window document localStorage sessionStorage"
  ).split(" "),
);
/** Each part of the path is a built-in member, an index, or a one-letter minified variable. */
const builtInPath = (inner: string) =>
  CODE.test(inner) &&
  inner
    .split(/[.[\]()]+/)
    .filter(Boolean)
    .every((part) => BUILT_IN.has(part) || /^\d+$/.test(part) || /^[a-z]$/.test(part));
/** Around a kept piece's letter while digits are scrubbed: U+2063, removed from the message first. */
const MARK = String.fromCharCode(0x2063);
/** Pieces of code kept per message, one letter each (a–z); past that, quoted code is scrubbed too. */
const MAX_HELD = 26;

/** The desk's and the board's pages, and /admin's (D115). */
const SECTIONS = new Set([
  "board",
  "calendar",
  "follow-up",
  "how-to",
  "import",
  "members",
  "no-access",
  "notices",
  "roll-call",
  "shots",
  "start-here",
  "thefts",
  "errors",
  "runs",
]);

/** The URL up to its query string or hash: what a visitor typed never leaves the browser. */
export function withoutQuery(url: string): string {
  return url.split(/[?#]/, 1)[0] ?? "";
}

const sectionOf = (segment: string | undefined) =>
  !segment ? "home" : SECTIONS.has(segment) ? segment : "other";

export function areaOf(path: string): { area: Area; workspace?: string; section?: string } {
  const admin = /^\/admin(?:\/([^/]*)|$)/.exec(path);
  if (admin) return { area: "admin", section: sectionOf(admin[1]) };
  const desk = /^\/w\/([^/]+)(?:\/([^/]*))?/.exec(path);
  return desk?.[1]
    ? { area: "workspace", workspace: desk[1], section: sectionOf(desk[2]) }
    : { area: "public" };
}

/** An exception message without what could name or locate a person (D115); see the header. */
export function scrubMessage(text: string): string {
  const held: string[] = [];
  const quoted = text
    .replaceAll(MARK, "")
    .replace(URL_IN_TEXT, "$1")
    .replace(EMAIL, "[email]")
    .replace(QUOTED, (all: string, ...groups: unknown[]) => {
      const inner = String(groups[1] ?? groups[2] ?? groups[3] ?? "");
      const at = groups[4] as number;
      const whole = groups[5] as string;
      const code = builtInPath(inner) && CODE_BEFORE.test(whole.slice(Math.max(0, at - 11), at));
      if (!code || held.length === MAX_HELD) return `${all.at(0)}…${all.at(-1)}`;
      held.push(all);
      return `${MARK}${String.fromCharCode(97 + held.length - 1)}${MARK}`;
    });
  return quoted
    .replace(/\d+/g, "#")
    .split(MARK)
    .map((part, i) => (i % 2 === 1 ? (held[part.charCodeAt(0) - 97] ?? "") : part))
    .join("");
}

const scrub = (value: unknown) => (typeof value === "string" ? scrubMessage(value) : value);

function cutValue(key: string, value: unknown): unknown {
  if (typeof value !== "string") return value;
  if (key === "$elements_chain") return value.replace(HREF_IN_CHAIN, '$1$2"');
  return URL_LIKE.test(value) ? withoutQuery(value) : value;
}

function cutElements(elements: unknown): unknown {
  if (!Array.isArray(elements)) return elements;
  return elements.map((el: Props) => ({
    ...el,
    ...("attr__href" in el && { attr__href: cutValue("attr__href", el.attr__href) }),
  }));
}

interface ExceptionEntry {
  value?: unknown;
  stacktrace?: { frames?: Props[] };
}

function cutException(entry: ExceptionEntry): ExceptionEntry {
  const frames = entry.stacktrace?.frames?.map((frame) =>
    Object.fromEntries(Object.entries(frame).map(([k, v]) => [k, cutValue(k, v)])),
  );
  return {
    ...entry,
    value: scrub(entry.value),
    ...(entry.stacktrace && { stacktrace: { ...entry.stacktrace, ...(frames && { frames }) } }),
  };
}

function cutProps(props: Props): Props {
  const out: Props = {};
  for (const [key, value] of Object.entries(props)) {
    if (!FROM_QUERY.test(key)) out[key] = cutValue(key, value);
  }
  if ("$elements" in props) out.$elements = cutElements(props.$elements);
  if (Array.isArray(props.$exception_list)) {
    out.$exception_list = props.$exception_list.map(cutException);
  }
  if (Array.isArray(props.$exception_values)) {
    out.$exception_values = props.$exception_values.map(scrub);
  }
  if ("$exception_message" in props) out.$exception_message = scrub(props.$exception_message);
  return out;
}

/** `currentPath` is the page's path when the event has none of its own (replay snapshots). */
export function sanitiseEvent<T extends Captured>(event: T, currentPath: string): T {
  const own = event.properties.$pathname;
  const { area, workspace, section } = areaOf(
    withoutQuery(typeof own === "string" ? own : currentPath),
  );
  const properties = cutProps(event.properties);
  properties.area = area;
  if (workspace) properties.workspace = workspace;
  else {
    // Issue 452: off /w/<slug>, no workspace or alliance, whatever the SDK still holds (a public page's
    // view is captured before followPath unregisters them).
    delete properties.workspace;
    delete properties.alliance;
  }
  if (section) properties.section = section;
  return {
    ...event,
    properties,
    ...(event.$set && { $set: cutProps(event.$set) }),
    ...(event.$set_once && { $set_once: cutProps(event.$set_once) }),
  };
}
