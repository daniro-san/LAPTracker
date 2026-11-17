// A JPEG's or WebP's width and height from its header, read before anything decodes it (issue 299 review):
// Tesseract's image library would otherwise allocate a picture of any size it is sent. Pure.

export interface PictureSize {
  width: number;
  height: number;
}

/** JPEG start-of-frame markers (baseline, progressive, …): C0-CF except C4, C8 and CC. */
const isFrame = (marker: number) =>
  marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;

function jpegSize(b: Buffer): PictureSize | null {
  for (let at = 2; at + 9 < b.length;) {
    if (b[at] !== 0xff) return null;
    const marker = b[at + 1] ?? 0;
    if (isFrame(marker)) return { height: b.readUInt16BE(at + 5), width: b.readUInt16BE(at + 7) };
    at += 2 + b.readUInt16BE(at + 2);
  }
  return null;
}

function webpSize(b: Buffer): PictureSize | null {
  const chunk = b.toString("latin1", 12, 16);
  if (chunk === "VP8 " && b.length >= 30) {
    return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
  }
  if (chunk === "VP8L" && b.length >= 25) {
    const bits = b.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  if (chunk === "VP8X" && b.length >= 30) {
    return { width: b.readUIntLE(24, 3) + 1, height: b.readUIntLE(27, 3) + 1 };
  }
  return null;
}

/** The size a JPEG or WebP says it has; null for any other format or a header that cannot be read. */
export function pictureSize(image: Uint8Array): PictureSize | null {
  const b = Buffer.from(image.buffer, image.byteOffset, image.byteLength);
  try {
    if (b[0] === 0xff && b[1] === 0xd8) return jpegSize(b);
    if (b.toString("latin1", 0, 4) === "RIFF" && b.toString("latin1", 8, 12) === "WEBP") {
      return webpSize(b);
    }
  } catch {
    return null;
  }
  return null;
}
