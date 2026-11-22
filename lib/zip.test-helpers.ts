// The reader the tests open "Download our data" ZIPs (lib/zip.ts) with: Node's own zlib, no dependency. Used
// by the export's route test and by the e2e privacy sweep (e2e/isolation.spec.ts).
import { crc32, inflateRawSync } from "node:zlib";

/** Every file of a ZIP, unpacked; a file whose CRC-32 does not match throws. */
export function unzip(bytes: Uint8Array): Map<string, Buffer> {
  const b = Buffer.from(bytes);
  const end = b.length - 22;
  const entries = b.readUInt16LE(end + 10);
  let at = b.readUInt32LE(end + 16);
  const files = new Map<string, Buffer>();
  for (let i = 0; i < entries; i += 1) {
    const method = b.readUInt16LE(at + 10);
    const crc = b.readUInt32LE(at + 16);
    const size = b.readUInt32LE(at + 20);
    const nameLength = b.readUInt16LE(at + 28);
    const local = b.readUInt32LE(at + 42);
    const name = b.toString("utf8", at + 46, at + 46 + nameLength);
    const start = local + 30 + b.readUInt16LE(local + 26) + b.readUInt16LE(local + 28);
    const stored = b.subarray(start, start + size);
    const data = method === 8 ? inflateRawSync(stored) : stored;
    if (crc32(data) !== crc) throw new Error(`unzip: ${name} fails its CRC-32`);
    files.set(name, data);
    at += 46 + nameLength + b.readUInt16LE(at + 30) + b.readUInt16LE(at + 32);
  }
  return files;
}
