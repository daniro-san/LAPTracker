// For tests of a notice's picture (D119): the start of a PNG (signature and IHDR) of the given size, which is
// all the server's check reads.
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
