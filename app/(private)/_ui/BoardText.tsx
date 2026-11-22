// The members' board's text helpers (D105), rendered on the server: a text written in several languages as
// tabs (the viewer's language first and open), a tag on the card when the viewer's language is not there,
// the out-of-date line, and a link's label by where it goes.
import type { ReactNode } from "react";

import { Tag } from "@/lib/brand/components/Tag";
import type {
  WorkspaceDictionary,
  WorkspaceKey,
  WorkspaceLanguage,
} from "@/lib/private/dictionary";
import { NOTICE_LANGUAGES, type NoticeLanguage } from "@/lib/private/notice-rules";
import { fill } from "@/lib/words";

import { LanguageTabs, type LanguagePanel } from "./BoardParts";
import { LANGUAGE_CODE, LANGUAGE_NAME } from "./languages";

export const LINK =
  "inline-flex min-h-11 items-center font-semibold text-plum underline underline-offset-4";
export const TEXT = "break-words whitespace-pre-wrap";

const languageName = (t: WorkspaceDictionary, l: string) => t[`board.lang.${l}` as WorkspaceKey];

/** The written languages, the viewer's first, then the others in the usual order. */
function inOrder(written: readonly string[], language: WorkspaceLanguage): NoticeLanguage[] {
  return NOTICE_LANGUAGES.filter((l) => written.includes(l)).sort(
    (a, b) => Number(b === language) - Number(a === language),
  );
}

/** "English only for now" (one language written) or "Not in Portuguese yet"; null in the viewer's own. */
export function LanguageTag(props: {
  t: WorkspaceDictionary;
  language: WorkspaceLanguage;
  written: readonly string[];
}) {
  const { t, language, written } = props;
  if (written.length === 0 || written.includes(language)) return null;
  const [only] = written;
  const text =
    written.length === 1 && only
      ? fill(t["board.onlyIn"], { lang: languageName(t, only) })
      : fill(t["board.notIn"], { lang: languageName(t, language) });
  return <Tag tone="attention">{text}</Tag>;
}

export function Translated(props: {
  id: string;
  t: WorkspaceDictionary;
  language: WorkspaceLanguage;
  written: readonly string[];
  /** Languages that may be behind the newest: their panel says so first. */
  stale?: readonly NoticeLanguage[];
  body: (l: NoticeLanguage) => ReactNode;
}) {
  const { t } = props;
  const panels: LanguagePanel[] = inOrder(props.written, props.language).map((l) => ({
    language: l,
    short: LANGUAGE_CODE[l],
    name: LANGUAGE_NAME[l],
    body: props.stale?.includes(l) ? (
      <>
        <p className="mt-1 text-body-sm font-semibold text-yarn">{t["board.stale"]}</p>
        {props.body(l)}
      </>
    ) : (
      props.body(l)
    ),
  }));
  return <LanguageTabs id={props.id} label={t["board.read"]} panels={panels} />;
}

/** "Open in Discord" for a Discord address, else "Open link (opens example.com)". */
export function linkLabel(link: string, t: WorkspaceDictionary): string {
  const host = new URL(link).hostname.replace(/^www\./, "");
  if (/(^|\.)(discord\.com|discord\.gg|discordapp\.com)$/.test(host))
    return t["board.link.discord"];
  return fill(t["board.link"], { host });
}
