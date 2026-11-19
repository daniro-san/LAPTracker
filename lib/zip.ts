// A small ZIP writer (D125) for "Download our data": no dependency, Node's own zlib. Text files are
// compressed (deflate, method 8), pictures already are, so they are stored as they are (method 0). File
// names are UTF-8 (flag bit 11). No ZIP64: the whole file stays under the 4.5 MB response limit.
import { crc32, deflateRawSync } from "node:zlib";

export interface ZipEntry {
  /** The path inside the ZIP, with "/" between folders. */
  name: string;
  data: Uint8Array;
  /** Deflate it (text); false stores it as it is (an image already compressed). */
  compress: boolean;
}

const UTF8_NAMES = 0x0800;
const VERSION = 20;

/** The MS-DOS time and date of an instant, in UTC (ZIP has no time zone). */
function dosTime(at: Date): { time: number; date: number } {
  const time = (at.getUTCHours() << 11) | (at.getUTCMinutes() << 5) | (at.getUTCSeconds() >> 1);
  const date =
    ((at.getUTCFullYear() - 1980) << 9) | ((at.getUTCMonth() + 1) << 5) | at.getUTCDate();
  return { time, date };
}

/** How many bytes the entry adds to the ZIP: its two headers, its name twice and its stored data. */
export function zipEntrySize(name: string, storedBytes: number): number {
  return 30 + 46 + 2 * Buffer.byteLength(name) + storedBytes;
}

/** The end-of-archive record's size. */
export const ZIP_END_SIZE = 22;

/** A packed entry: what to write, and the facts both headers repeat. */
export interface Packed {
  name: Buffer;
  stored: Uint8Array;
  method: number;
  crc: number;
  size: number;
}

/** One entry compressed (or not) and summed, ready for `zip`; `stored.byteLength` is what it adds. */
export function pack(entry: ZipEntry): Packed {
  const stored = entry.compress ? deflateRawSync(entry.data) : entry.data;
  return {
    name: Buffer.from(entry.name, "utf8"),
    stored,
    method: entry.compress ? 8 : 0,
    crc: crc32(entry.data),
    size: entry.data.byteLength,
  };
}

/** The fields the local header and the central directory share, from "version needed" to the name length. */
function common(p: Packed, at: { time: number; date: number }): Buffer {
  const b = Buffer.alloc(26);
  b.writeUInt16LE(VERSION, 0);
  b.writeUInt16LE(UTF8_NAMES, 2);
  b.writeUInt16LE(p.method, 4);
  b.writeUInt16LE(at.time, 6);
  b.writeUInt16LE(at.date, 8);
  b.writeUInt32LE(p.crc, 10);
  b.writeUInt32LE(p.stored.byteLength, 14);
  b.writeUInt32LE(p.size, 18);
  b.writeUInt16LE(p.name.byteLength, 22);
  // Extra field length (24): none.
  return b;
}

/** The ZIP of `entries` (already packed with `pack`), every file dated `at`. */
export function zip(entries: Packed[], at: Date): Uint8Array {
  const when = dosTime(at);
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const p of entries) {
    const shared = common(p, when);
    const local = Buffer.alloc(4);
    local.writeUInt32LE(0x04034b50, 0);
    parts.push(local, shared, p.name, p.stored);
    const head = Buffer.alloc(6);
    head.writeUInt32LE(0x02014b50, 0);
    head.writeUInt16LE(VERSION, 4);
    // Comment length, disk, internal and external attributes: none; then the local header's offset.
    const tail = Buffer.alloc(14);
    tail.writeUInt32LE(offset, 10);
    central.push(head, shared, tail, p.name);
    offset += 4 + shared.byteLength + p.name.byteLength + p.stored.byteLength;
  }
  const size = central.reduce((n, b) => n + b.byteLength, 0);
  const end = Buffer.alloc(ZIP_END_SIZE);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(size, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, ...central, end]);
}
