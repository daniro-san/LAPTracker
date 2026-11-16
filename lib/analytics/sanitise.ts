// PostHog's `before_send` (D77), pure so it can be tested without a browser. Every event leaves with:
// - no query string and no hash in any URL-like property, as D36 does for Vercel's scripts (`/players?q=<name>`
//   would carry a typed name), and none of the properties the SDK reads from a query string;
// - `area` (public, workspace or admin) and, on /w/<slug>, `workspace`, read from the event's own path, so an
//   event sent during a client-side navigation never carries the previous page's area;
// - on the workspace and /admin, which show per-member values (D71, D76), exception messages replaced by a fixed
//   text. Their type and stack frames stay. A pattern rule (a coordinate pair, a timestamp) would miss values
//   printed some other way and name nobody, so the whole message goes.
export type Area = "public" | "workspace" | "admin";

type Props = Record<string, unknown>;

/** The fields of a PostHog CaptureResult this module reads. */
export interface Captured {
  event: string;
  properties: Props;
  $set?: Props;
  $set_once?: Props;
}

export const MASKED_MESSAGE = "[masked]";
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

/** The URL up to its query string or hash: what a visitor typed never leaves the browser. */
export function withoutQuery(url: string): string {
  return url.split(/[?#]/, 1)[0] ?? "";
}

export function areaOf(path: string): { area: Area; workspace?: string } {
  if (/^\/admin(?:\/|$)/.test(path)) return { area: "admin" };
  const slug = /^\/w\/([^/]+)/.exec(path)?.[1];
  return slug ? { area: "workspace", workspace: slug } : { area: "public" };
}

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

function cutException(entry: ExceptionEntry, masked: boolean): ExceptionEntry {
  const value =
    typeof entry.value === "string" ? entry.value.replace(URL_IN_TEXT, "$1") : entry.value;
  const frames = entry.stacktrace?.frames?.map((frame) =>
    Object.fromEntries(Object.entries(frame).map(([k, v]) => [k, cutValue(k, v)])),
  );
  return {
    ...entry,
    value: masked ? MASKED_MESSAGE : value,
    ...(entry.stacktrace && { stacktrace: { ...entry.stacktrace, ...(frames && { frames }) } }),
  };
}

function cutProps(props: Props, maskExceptions: boolean): Props {
  const out: Props = {};
  for (const [key, value] of Object.entries(props)) {
    if (!FROM_QUERY.test(key)) out[key] = cutValue(key, value);
  }
  if ("$elements" in props) out.$elements = cutElements(props.$elements);
  if (Array.isArray(props.$exception_list)) {
    out.$exception_list = props.$exception_list.map((e: ExceptionEntry) =>
      cutException(e, maskExceptions),
    );
  }
  if (maskExceptions && Array.isArray(props.$exception_values)) {
    out.$exception_values = props.$exception_values.map(() => MASKED_MESSAGE);
  }
  return out;
}

/** `currentPath` is the page's path when the event has none of its own (replay snapshots). */
export function sanitiseEvent<T extends Captured>(event: T, currentPath: string): T {
  const own = event.properties.$pathname;
  const { area, workspace } = areaOf(withoutQuery(typeof own === "string" ? own : currentPath));
  const masked = area !== "public";
  const properties = cutProps(event.properties, masked);
  properties.area = area;
  if (workspace) properties.workspace = workspace;
  return {
    ...event,
    properties,
    ...(event.$set && { $set: cutProps(event.$set, masked) }),
    ...(event.$set_once && { $set_once: cutProps(event.$set_once, masked) }),
  };
}
