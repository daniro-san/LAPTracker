// What's new on the desk (issue 782): the officer notes of lib/patch-notes.ts whose features this workspace has
// on, newest first, so an alliance never reads about a feature it does not have. Home says "New: <title>"
// until the officer opens the page; "seen" is the newest release opened, on the officer's own row.
import type { Db } from "../db";
import { patchNotes, type DeskWords } from "../patch-notes";
import { setWhatsNewSeen, whatsNewSeen } from "../repo/workspaces";
import type { WorkspaceAccess } from "./access";
import type { WorkspaceLanguage } from "./dictionary";
import { featureOn, type WithFeatures } from "./features";

export interface WhatsNewItem {
  version: string;
  /** The release's day, YYYY-MM-DD. */
  date: string;
  title: string;
  text: string;
}

/** The officer notes this workspace's features allow, newest release first. */
const allowed = (ws: Pick<WithFeatures, "features">) =>
  patchNotes.flatMap(({ version, date, officer = [] }) =>
    officer
      .filter((note) => (note.needs ?? []).every((f) => featureOn(ws, f)))
      .map((note) => ({ version, date, note })),
  );

/** The same, in `language`. */
export function whatsNew(
  ws: Pick<WithFeatures, "features">,
  language: WorkspaceLanguage,
): WhatsNewItem[] {
  return allowed(ws).map(({ version, date, note }) => ({
    version,
    date,
    title: note.title[language],
    text: note.text[language],
  }));
}

/** v5.10.0 after v5.9.0: compare the numbers, not the letters. */
const newer = (a: string, b: string) => a.localeCompare(b, "en", { numeric: true }) > 0;

/** Home's line: the newest note's title while this officer has not opened its release; else null. */
export async function whatsNewLine(db: Db, access: WorkspaceAccess): Promise<DeskWords | null> {
  const [first] = allowed(access);
  if (!first) return null;
  const seen = await whatsNewSeen(db, access.workspaceId, access.user.id);
  return seen === null || newer(first.version, seen) ? first.note.title : null;
}

/** The page's notes; opening it marks the newest release seen by this officer only. */
export async function openWhatsNew(
  db: Db,
  access: WorkspaceAccess,
  language: WorkspaceLanguage,
): Promise<WhatsNewItem[]> {
  const items = whatsNew(access, language);
  if (items[0]) await setWhatsNewSeen(db, access.workspaceId, access.user.id, items[0].version);
  return items;
}
