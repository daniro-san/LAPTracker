// A JPEG's, WebP's or PNG's width and height from its header, read before anything decodes it (issue 299
// review): Tesseract's image library would otherwise allocate a picture of any size it is sent. Pure and
// browser-safe (DataView, no Buffer): a notice picture's resize reads it in the browser too (D119), and
// `isAnimated` tells an animated WebP or PNG, which a notice picture may not be.

export interface PictureSize {
  width: number;
  height: number;
}

/** JPEG start-of-frame markers (baseline, progressive, …): C0-CF except C4, C8 and CC. */
const isFrame = (marker: number) =>
  marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;

const text = (b: Uint8Array, from: number, to: number) =>
  String.fromCharCode(...b.subarray(from, Math.min(to, b.length)));
const view = (b: Uint8Array) => new DataView(b.buffer, b.byteOffset, b.byteLength);
const uint24 = (v: DataView, at: number) =>
  v.getUint8(at) | (v.getUint8(at + 1) << 8) | (v.getUint8(at + 2) << 16);

function jpegSize(b: Uint8Array): PictureSize | null {
  const v = view(b);
  for (let at = 2; at + 9 < b.length;) {
    if (b[at] !== 0xff) return null;
    const marker = b[at + 1] ?? 0;
    if (isFrame(marker)) return { height: v.getUint16(at + 5), width: v.getUint16(at + 7) };
    at += 2 + v.getUint16(at + 2);
  }
  return null;
}

function webpSize(b: Uint8Array): PictureSize | null {
  const v = view(b);
  const chunk = text(b, 12, 16);
  if (chunk === "VP8 " && b.length >= 30) {
    return { width: v.getUint16(26, true) & 0x3fff, height: v.getUint16(28, true) & 0x3fff };
  }
  if (chunk === "VP8L" && b.length >= 25) {
    const bits = v.getUint32(21, true);
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  if (chunk === "VP8X" && b.length >= 30) {
    return { width: uint24(v, 24) + 1, height: uint24(v, 27) + 1 };
  }
  return null;
}

const isPng = (b: Uint8Array) => b[0] === 0x89 && text(b, 1, 4) === "PNG";
const isWebp = (b: Uint8Array) => text(b, 0, 4) === "RIFF" && text(b, 8, 12) === "WEBP";

/** The size a JPEG, WebP or PNG says it has; null for any other format or a header that cannot be read. */
export function pictureSize(image: Uint8Array): PictureSize | null {
  try {
    if (image[0] === 0xff && image[1] === 0xd8) return jpegSize(image);
    // A PNG's first chunk is IHDR (D119: a notice picture may be a PNG).
    if (isPng(image)) {
      if (text(image, 12, 16) !== "IHDR") return null;
      const v = view(image);
      return { width: v.getUint32(16), height: v.getUint32(20) };
    }
    if (isWebp(image)) return webpSize(image);
  } catch {
    return null;
  }
  return null;
}

/**
 * Whether the picture moves: a WebP whose VP8X header sets the animation flag, or a PNG with an `acTL`
 * chunk before its first IDAT (APNG). A notice picture may not (review of PR 422).
 */
export function isAnimated(image: Uint8Array): boolean {
  if (isWebp(image)) return text(image, 12, 16) === "VP8X" && ((image[20] ?? 0) & 0x02) !== 0;
  if (!isPng(image)) return false;
  const v = view(image);
  for (let at = 8; at + 8 <= image.length;) {
    const type = text(image, at + 4, at + 8);
    if (type === "acTL") return true;
    if (type === "IDAT") return false;
    at += 12 + v.getUint32(at);
  }
  return false;
}
