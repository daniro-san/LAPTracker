// What an error means and what to do (D61): our one-line error texts ("v1 TimeoutError", "v1 http 504",
// "not fetched: deadline", "render TypeError", …) matched to an entry of copy.admin.guide. Pure.
import { copy, fill } from "./copy";

export interface Guide {
  meaning: string;
  action: string;
}

type Key = keyof typeof copy.admin.guide.entries;

/** First match wins; the run-level and app-level words come before the upstream ones. */
const RULES: [RegExp, Key][] = [
  [/^not fetched/, "notFetched"],
  [/^(render|route|action|proxy) /, "page"],
  [/^quota: remaining/, "quotaRule"],
  [/^deadline$/, "deadline"],
  [/MAX_UPSTREAM_CALLS/, "callCap"],
  [/TimeoutError/, "timeout"],
  [/quota exhausted|http 429/, "quota"],
  [/http 40[13]/, "auth"],
  [/not found|http 404/, "notFound"],
  [/http 5\d\d/, "gateway"],
  [/http \d{3}/, "http"],
  [/schema/, "schema"],
  [/TypeError|AbortError/, "network"],
];

export function guideFor(error: string): Guide {
  const key = RULES.find(([pattern]) => pattern.test(error))?.[1] ?? "unknown";
  const entry = copy.admin.guide.entries[key];
  const status = /http (\d{3})/.exec(error)?.[1] ?? "";
  return { meaning: fill(entry.meaning, { status }), action: entry.action };
}
