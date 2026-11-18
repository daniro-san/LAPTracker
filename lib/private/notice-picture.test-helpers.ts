// For tests of a notice's picture (D119): the start of a PNG (signature and IHDR), a WebP (VP8X) or an
// animated PNG of the given size, which is all the server's check reads.
const ascii = (s: string) => [...new TextEncoder().encode(s)];

export function pngHeader(width: number, height: number): Uint8Array<ArrayBuffer> {
  const b = new Uint8Array(33);
  const view = new DataView(b.buffer);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  view.setUint32(8, 13);
  b.set([0x49, 0x48, 0x44, 0x52], 12);
  view.setUint32(16, width);
  view.setUint32(20, height);
  b.set([8, 6, 0, 0, 0], 24);
  return b;
}

/** A WebP with a VP8X header of the given size; `animated` sets its animation flag. */
export function webpHeader(
  width: number,
  height: number,
  animated = false,
): Uint8Array<ArrayBuffer> {
  const b = new Uint8Array(30);
  const view = new DataView(b.buffer);
  b.set(ascii("RIFF"), 0);
  view.setUint32(4, 22, true);
  b.set(ascii("WEBPVP8X"), 8);
  view.setUint32(16, 10, true);
  b[20] = animated ? 0x02 : 0;
  const side = (at: number, n: number) => b.set([n & 255, (n >> 8) & 255, (n >> 16) & 255], at);
  side(24, width - 1);
  side(27, height - 1);
  return b;
}

/** An animated PNG: IHDR, then an `acTL` chunk before any IDAT. */
export function apngHeader(width: number, height: number): Uint8Array<ArrayBuffer> {
  const actl = new Uint8Array(20);
  const view = new DataView(actl.buffer);
  view.setUint32(0, 8);
  actl.set(ascii("acTL"), 4);
  view.setUint32(8, 2);
  const b = new Uint8Array(33 + actl.length);
  b.set(pngHeader(width, height));
  b.set(actl, 33);
  return b;
}
