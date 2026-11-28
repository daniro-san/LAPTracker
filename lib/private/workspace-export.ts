// "Download our data" (D125, issue 441): everything the workspace owns as a ZIP of CSV files (UTF-8 with a
// BOM, so Excel reads accents), the notices' pictures as files, and a README in the officer's language that
// names each file and its columns. Built on the server, in memory: it must stay under Vercel's 4.5 MB
// response limit, so the pictures that would pass it are left out (newest kept) and the README says so.
// Never in it: x, y, online, last_online_at (CLAUDE.md, D71), avatar_url, the tracker key, sessions or any
// secret (lib/repo/workspace-data.ts reads the tables and drops those columns).
import type { Db } from "../db";
import { recordFailure } from "../repo/auth-attempts";
import {
  claimDataEvent,
  dropDataEvent,
  newMemberNames,
  noticePictureBytes,
  noticePictureList,
  peopleNames,
  workspaceDumps,
  type TableDump,
} from "../repo/workspace-data";
import { lastSeen } from "../repo/workspace-past-roster";
import { exportLimitKey } from "../repo/workspace-purge";
import { fill } from "../words";
import { pack, zip, ZIP_END_SIZE, zipEntrySize, type Packed } from "../zip";
import type { WorkspaceAccess } from "./access";
import { activityPage } from "./desk-activity";
import { activityLine } from "./desk-activity-words";
import type { WorkspaceDictionary, WorkspaceKey, WorkspaceLanguage } from "./dictionary";
import { formerMembers } from "./former-members";

/** Under Vercel's 4.5 MB function response limit, with room for the headers. */
export const EXPORT_MAX_BYTES = 4_400_000;
/** Room kept for the README, written last because it names the pictures left out. */
const README_ROOM = 64_000;
/** Downloads per workspace in a rolling 24 hours from the first (D125), counted in auth_attempts. */
export const EXPORTS_PER_DAY = 3;
const DAY_MS = 24 * 60 * 60_000;

/** What the download is written in and for: the officer's words, the clock and the alliance's name. */
export interface ExportWords {
  now: Date;
  /** The server's zone (SERVER_TZ). */
  zone: string;
  language: WorkspaceLanguage;
  t: WorkspaceDictionary;
  /** "TAG · Name", for the README's title. */
  alliance: string;
}

const BOM = "\uFEFF";
const text = new TextEncoder();

/** One cell. A text a spreadsheet would run as a formula (= + - @) is kept as text with a leading '. */
function cell(value: unknown, separator: string): string {
  let s: string;
  if (value === null || value === undefined) s = "";
  else if (value instanceof Date) s = value.toISOString();
  else if (typeof value === "object") s = JSON.stringify(value);
  else s = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  const quote = s.includes(separator) || /["\r\n]/.test(s);
  return quote ? `"${s.replaceAll('"', '""')}"` : s;
}

/**
 * The separator Excel expects where each language is spoken (owner, 2026-11-19): ";" in Brazil and France,
 * whose decimal comma makes ";" their list separator, "," in English.
 */
export const CSV_SEPARATOR: Record<WorkspaceLanguage, string> = { en: ",", "pt-BR": ";", fr: ";" };

/** A CSV file: a BOM, the header, then one line per row, CRLF as Excel writes them. */
function csv(columns: string[], rows: unknown[][], separator: string): Uint8Array {
  const lines = [columns, ...rows].map((r) => r.map((v) => cell(v, separator)).join(separator));
  return text.encode(`${BOM}${lines.join("\r\n")}\r\n`);
}

/** A file of the download, before packing: its name, columns, rows and README words. */
interface Sheet {
  file: string;
  columns: string[];
  rows: unknown[][];
  about: string;
}

/**
 * A table as the officer reads it: who did something as a name, and each member's name beside their uid.
 * A table that keeps deleted records becomes two files: the live ones, and `-deleted`.
 */
function sheetsOf(
  dump: TableDump,
  names: { people: Map<number, string>; members: Map<number, string> },
  t: WorkspaceDictionary,
): Sheet[] {
  const officer = new Set(dump.officerColumns.map((c) => dump.columns.indexOf(c)));
  const uidAt = dump.columns.indexOf("uid");
  const columns = [...dump.columns];
  if (uidAt >= 0) columns.splice(uidAt + 1, 0, "member");
  const rows = dump.rows.map((row) => {
    const out = row.map((v, i) =>
      officer.has(i) && v !== null ? (names.people.get(Number(v)) ?? v) : v,
    );
    if (uidAt >= 0) out.splice(uidAt + 1, 0, names.members.get(Number(row[uidAt])) ?? null);
    return out;
  });
  const about = t[`data.file.${dump.file}` as WorkspaceKey];
  if (dump.deletedColumn === null) return [{ file: dump.file, columns, rows, about }];
  const at = columns.indexOf(dump.deletedColumn);
  return [
    { file: dump.file, columns, rows: rows.filter((r) => r[at] === null), about },
    {
      file: `${dump.file}-deleted`,
      columns,
      rows: rows.filter((r) => r[at] !== null),
      about: fill(t["data.deletedFile"], { what: about }),
    },
  ];
}

/** Home's recent activity of the last two weeks, every line as Home says it, newest first. */
async function activitySheet(db: Db, access: WorkspaceAccess, words: ExportWords): Promise<Sheet> {
  const rows: unknown[][] = [];
  let before: Date | null = null;
  do {
    const page = await activityPage(db, access, words, before, 200);
    for (const line of page.lines) {
      for (const item of line.run.length > 0 ? line.run : [line.item]) {
        // The bidi marks isolate() adds are for the screen, not for a cell.
        const said = activityLine(item, words.t, words.language).replace(/[\u2066-\u2069]/g, "");
        rows.push([item.at, said]);
      }
    }
    before = page.next;
  } while (before);
  return { file: "activity", columns: ["at", "line"], rows, about: words.t["data.file.activity"] };
}

/** The README: what the download is, how to open it, what was left out, then each file and its columns. */
function readme(
  sheets: Sheet[],
  facts: { alliance: string; who: string; now: Date; pictures: boolean; left: number },
  t: WorkspaceDictionary,
): string {
  const lines = [
    fill(t["readme.title"], { alliance: facts.alliance }),
    fill(t["readme.made"], {
      date: facts.now.toISOString().slice(0, 16).replace("T", " "),
      who: facts.who,
    }),
    "",
    t["readme.open"],
    t["readme.times"],
    t["readme.deleted"],
    t["readme.left"],
    ...(facts.pictures ? [t["readme.pictures"]] : []),
    ...(facts.left > 0 ? [fill(t["readme.picturesLeft"], { n: facts.left })] : []),
    "",
    `${t["readme.files"]}:`,
  ];
  for (const s of sheets) {
    lines.push(
      "",
      `${s.file}.csv (${fill(t["readme.rows"], { n: s.rows.length })})`,
      `  ${s.about}`,
    );
    lines.push(`  ${t["readme.columns"]}: ${s.columns.join(", ")}`);
  }
  return `${BOM}${lines.join("\r\n")}\r\n`;
}

const EXTENSION: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
};

/** The ZIP: every sheet, then the pictures newest first while they fit, then the README in front. */
async function buildZip(
  db: Db,
  access: WorkspaceAccess,
  words: ExportWords,
): Promise<Uint8Array | null> {
  const ws = { id: access.workspaceId, unionId: access.unionId };
  const [dumps, people, seen, added, former, activity] = await Promise.all([
    workspaceDumps(db, ws),
    peopleNames(db, ws.id),
    lastSeen(db, ws.unionId),
    newMemberNames(db, ws.id),
    formerMembers(db, access, words.zone),
    activitySheet(db, access, words),
  ]);
  const members = new Map([...seen.map((s) => [s.uid, s.name] as const), ...added]);
  const sheets = [
    ...dumps.flatMap((d) => sheetsOf(d, { people, members }, words.t)),
    {
      file: "former-members",
      columns: ["uid", "name", "last_seen", "might", "kills", "left_reason", "left_note"],
      // Why they left (issue 469), in the officer's words; empty when no reason was saved.
      rows: former.map((f) => {
        const left = f.facts.leftReason?.value;
        const reason = left ? words.t[`former.reason.${left.reason}`] : null;
        return [f.uid, f.name, f.lastSeen, f.might, f.kills, reason, left?.note || null];
      }),
      about: words.t["data.file.former-members"],
    },
    activity,
  ];
  const packed: Packed[] = sheets.map((s) =>
    pack({
      name: `${s.file}.csv`,
      data: csv(s.columns, s.rows, CSV_SEPARATOR[words.language]),
      compress: true,
    }),
  );
  let size = ZIP_END_SIZE + README_ROOM;
  for (const p of packed) size += zipEntrySize(p.name.toString(), p.stored.byteLength);
  if (size > EXPORT_MAX_BYTES) return null;
  // One picture's bytes in memory at a time, read only when its size fits what is left.
  const pictures = await noticePictureList(db, ws.id);
  let left = 0;
  for (const pic of pictures) {
    const name = `pictures/notice-${pic.noticeId}.${EXTENSION[pic.type] ?? "bin"}`;
    const add = zipEntrySize(name, pic.size);
    const data =
      size + add > EXPORT_MAX_BYTES ? null : await noticePictureBytes(db, ws.id, pic.noticeId);
    if (!data) {
      left += 1;
      continue;
    }
    packed.push(pack({ name, data, compress: false }));
    size += add;
  }
  const facts = { alliance: words.alliance, who: access.user.displayName ?? "", now: words.now };
  const about = readme(sheets, { ...facts, pictures: pictures.length > left, left }, words.t);
  const head = pack({ name: "README.txt", data: text.encode(about), compress: true });
  return zip([head, ...packed], words.now);
}

export type ExportResult =
  | { ok: true; zip: Uint8Array; filename: string }
  | { ok: false; code: "rate_limited" | "too_large" };

/**
 * One download, under the request id the officer's tap made (D100): a repeat of it adds no second Home line,
 * but its ZIP counts. At most EXPORTS_PER_DAY in a rolling 24 hours per workspace; a refused one frees its
 * request id and leaves no Home line.
 */
export async function downloadData(
  db: Db,
  access: WorkspaceAccess,
  requestId: string,
  words: ExportWords,
): Promise<ExportResult> {
  const event = { workspaceId: access.workspaceId, by: access.user.id, at: words.now, requestId };
  const claimed = await claimDataEvent(db, { ...event, action: "download" });
  // Every ZIP built counts, a repeated request id's too (review of PR 449): the id only keeps Home to one
  // line per download.
  const count = await recordFailure(db, exportLimitKey(access.workspaceId), DAY_MS, words.now);
  if (count > EXPORTS_PER_DAY) {
    if (claimed) await dropDataEvent(db, access.workspaceId, requestId);
    return { ok: false, code: "rate_limited" };
  }
  const built = await buildZip(db, access, words);
  if (!built) {
    if (claimed) await dropDataEvent(db, access.workspaceId, requestId);
    return { ok: false, code: "too_large" };
  }
  const filename = `${access.slug}-data-${words.now.toISOString().slice(0, 10)}.zip`;
  return { ok: true, zip: built, filename };
}
