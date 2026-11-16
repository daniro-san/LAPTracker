// Image preparation for the OCR, with no native dependency (D74): a PNG screenshot is turned into
// an 8-bit greyscale PNG whose width is TARGET_WIDTH. The validation found greyscale at twice the
// width of a 358 px screenshot the best input; a 1170 px phone screenshot is brought down to the
// same text size. Anything that is not a plain 8-bit PNG is returned unchanged, unless its size is
// refused: a PNG with no pixels, or more pixels than MAX_PIXELS before or after resizing, throws.
import { crc32, deflateSync, inflateSync } from "node:zlib";

export const TARGET_WIDTH = 716;
export const MAX_PIXELS = 40_000_000;

/** The picture cannot be prepared: no pixels, too many pixels, or its data is larger than its header says. */
export class ImageRefusedError extends Error {
  constructor(reason: string) {
    super(`screenshot refused: ${reason}`);
    this.name = "ImageRefusedError";
  }
}
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
/** Colour type to samples per pixel. */
const CHANNELS: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

interface Grey {
  width: number;
  height: number;
  data: Uint8Array;
}

interface Header {
  width: number;
  height: number;
  colorType: number;
  /** 8 bits per sample, no interlacing, a known colour type: the only PNGs that are read. */
  plain: boolean;
  idat: Buffer[];
  palette: Buffer | null;
}

function readChunks(png: Buffer): Header | null {
  const idat: Buffer[] = [];
  let header: Omit<Header, "idat" | "palette"> | null = null;
  let palette: Buffer | null = null;
  for (let at = 8; at + 8 <= png.length;) {
    const length = png.readUInt32BE(at);
    const type = png.toString("latin1", at + 4, at + 8);
    const body = png.subarray(at + 8, at + 8 + length);
    if (type === "IHDR") {
      const colorType = body[9] ?? -1;
      header = {
        width: body.readUInt32BE(0),
        height: body.readUInt32BE(4),
        colorType,
        plain: body[8] === 8 && body[12] === 0 && colorType in CHANNELS,
      };
    } else if (type === "PLTE") palette = body;
    else if (type === "IDAT") idat.push(body);
    at += 12 + length;
  }
  return header ? { ...header, idat, palette } : null;
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/** The value a PNG row filter adds to a sample, from its neighbours to the left, above and above-left. */
function predictor(filter: number, left: number, up: number, upLeft: number): number {
  if (filter === 1) return left;
  if (filter === 2) return up;
  if (filter === 3) return (left + up) >> 1;
  return filter === 4 ? paeth(left, up, upLeft) : 0;
}

/** Undo the per-row filters of a PNG into raw samples. */
function unfilter(raw: Uint8Array, height: number, stride: number, bpp: number): Uint8Array {
  const out = new Uint8Array(height * stride);
  const at = (y: number, x: number) => (y >= 0 && x >= 0 ? (out[y * stride + x] ?? 0) : 0);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)] ?? 0;
    const src = y * (stride + 1) + 1;
    for (let x = 0; x < stride; x++) {
      const add = predictor(filter, at(y, x - bpp), at(y - 1, x), at(y - 1, x - bpp));
      out[y * stride + x] = ((raw[src + x] ?? 0) + add) & 0xff;
    }
  }
  return out;
}

const luma = (r = 0, g = 0, b = 0) => Math.round(0.299 * r + 0.587 * g + 0.114 * b);

/** The grey level of the pixel whose samples start at `s`. */
function greyAt(samples: Uint8Array, s: number, head: Header): number {
  if (head.colorType === 2 || head.colorType === 6)
    return luma(samples[s], samples[s + 1], samples[s + 2]);
  if (head.colorType === 3) {
    const p = (samples[s] ?? 0) * 3;
    return luma(head.palette?.[p], head.palette?.[p + 1], head.palette?.[p + 2]);
  }
  return samples[s] ?? 0;
}

/** The filtered rows of the picture; their size is known from the header, so a larger stream is refused. */
function inflateRows(head: Header, stride: number): Buffer {
  try {
    return inflateSync(Buffer.concat(head.idat), { maxOutputLength: head.height * (stride + 1) });
  } catch {
    throw new ImageRefusedError("its pixel data is larger than its header says, or damaged");
  }
}

function decodeGrey(head: Header): Grey {
  const channels = CHANNELS[head.colorType] as number;
  const stride = head.width * channels;
  const samples = unfilter(inflateRows(head, stride), head.height, stride, channels);
  const data = new Uint8Array(head.width * head.height);
  for (let i = 0; i < data.length; i++) data[i] = greyAt(samples, i * channels, head);
  return { width: head.width, height: head.height, data };
}

/** Bilinear when enlarging, box average when shrinking: each output sample reads its source footprint. */
function resize(img: Grey, width: number, height: number): Grey {
  const sx = img.width / width;
  const sy = img.height / height;
  const data = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    const y0 = sx > 1 ? y * sy : Math.max(0, (y + 0.5) * sy - 0.5);
    for (let x = 0; x < width; x++) {
      const x0 = sx > 1 ? x * sx : Math.max(0, (x + 0.5) * sx - 0.5);
      data[y * width + x] = sx > 1 ? boxAt(img, x0, y0, sx, sy) : bilinearAt(img, x0, y0);
    }
  }
  return { width, height, data };
}

function bilinearAt(img: Grey, x: number, y: number): number {
  const xi = Math.min(Math.floor(x), img.width - 1);
  const yi = Math.min(Math.floor(y), img.height - 1);
  const xn = Math.min(xi + 1, img.width - 1);
  const yn = Math.min(yi + 1, img.height - 1);
  const fx = x - xi;
  const fy = y - yi;
  const at = (px: number, py: number) => img.data[py * img.width + px] ?? 0;
  const top = at(xi, yi) * (1 - fx) + at(xn, yi) * fx;
  const bottom = at(xi, yn) * (1 - fx) + at(xn, yn) * fx;
  return Math.round(top * (1 - fy) + bottom * fy);
}

function boxAt(img: Grey, x: number, y: number, w: number, h: number): number {
  let sum = 0;
  let weight = 0;
  const xEnd = Math.min(x + w, img.width);
  const yEnd = Math.min(y + h, img.height);
  for (let py = Math.floor(y); py < yEnd; py++) {
    const wy = Math.min(py + 1, yEnd) - Math.max(py, y);
    for (let px = Math.floor(x); px < xEnd; px++) {
      const wx = Math.min(px + 1, xEnd) - Math.max(px, x);
      sum += (img.data[py * img.width + px] ?? 0) * wx * wy;
      weight += wx * wy;
    }
  }
  return Math.round(sum / weight);
}

function chunk(type: string, body: Uint8Array): Buffer {
  const out = Buffer.alloc(12 + body.length);
  out.writeUInt32BE(body.length, 0);
  out.write(type, 4, "latin1");
  out.set(body, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + body.length)), 8 + body.length);
  return out;
}

function encodeGrey(img: Grey): Buffer {
  const raw = Buffer.alloc(img.height * (img.width + 1));
  for (let y = 0; y < img.height; y++)
    raw.set(img.data.subarray(y * img.width, (y + 1) * img.width), y * (img.width + 1) + 1);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(img.width, 0);
  ihdr.writeUInt32BE(img.height, 4);
  ihdr[8] = 8;
  return Buffer.concat([
    PNG_SIGNATURE,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", new Uint8Array(0)),
  ]);
}

/** The height the picture has at TARGET_WIDTH; refused when its pixels (before or after) pass MAX_PIXELS or it has none. */
function outputHeight(head: Header): number {
  if (head.width === 0 || head.height === 0) throw new ImageRefusedError("it has no pixels");
  const height = Math.max(1, Math.round((head.height * TARGET_WIDTH) / head.width));
  if (head.width * head.height > MAX_PIXELS || TARGET_WIDTH * height > MAX_PIXELS)
    throw new ImageRefusedError("it has too many pixels");
  return height;
}

/**
 * The picture the OCR reads: greyscale at TARGET_WIDTH. Not a PNG, or not a plain 8-bit one: returned
 * as given. Throws ImageRefusedError for a PNG with no pixels or too many.
 */
export function prepareForOcr(image: Uint8Array): Uint8Array {
  const png = Buffer.from(image.buffer, image.byteOffset, image.byteLength);
  if (png.length < 8 || !png.subarray(0, 8).equals(PNG_SIGNATURE)) return image;
  const head = readChunks(png);
  if (!head) return image;
  const height = outputHeight(head);
  if (!head.plain || head.idat.length === 0) return image;
  return encodeGrey(resize(decodeGrey(head), TARGET_WIDTH, height));
}
