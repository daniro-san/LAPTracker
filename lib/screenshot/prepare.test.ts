import { crc32, deflateSync, inflateSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import { ImageRefusedError, prepareForOcr, TARGET_WIDTH } from "./prepare";
import { screenshot } from "./test-helpers";

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function chunk(type: string, body: Uint8Array): Buffer {
  const out = Buffer.alloc(12 + body.length);
  out.writeUInt32BE(body.length, 0);
  out.write(type, 4, "latin1");
  out.set(body, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + body.length)), 8 + body.length);
  return out;
}

/** A PNG whose header says width x height and whose pixel data is `rows` (filter bytes included). */
function png(width: number, height: number, colorType: number, rows: Uint8Array): Uint8Array {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = colorType;
  return Buffer.concat([
    SIGNATURE,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(rows)),
    chunk("IEND", new Uint8Array(0)),
  ]);
}

/** The grey samples of a PNG that `prepareForOcr` wrote: 8-bit grey, filter 0 on every row. */
function greyRows(out: Uint8Array): { width: number; height: number; rows: Uint8Array[] } {
  const buf = Buffer.from(out);
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  const idatLength = buf.readUInt32BE(33);
  const raw = inflateSync(buf.subarray(41, 41 + idatLength));
  const rows = Array.from({ length: height }, (_, y) =>
    raw.subarray(y * (width + 1) + 1, (y + 1) * (width + 1)),
  );
  return { width, height, rows };
}

describe("prepareForOcr", () => {
  it("turns a screenshot into an 8-bit greyscale PNG of the target width", () => {
    const source = screenshot("27-alliance-duel-weekly-mine");
    const out = Buffer.from(prepareForOcr(source));
    expect(out.subarray(1, 4).toString("latin1")).toBe("PNG");
    expect(out.readUInt32BE(16)).toBe(TARGET_WIDTH);
    // 358 x 768 enlarged to 716 wide keeps its proportions.
    expect(out.readUInt32BE(20)).toBe(1536);
    expect([out[24], out[25]]).toEqual([8, 0]);
  });

  it("makes text dark on white, both dark text on a light row and white text on the green own row", () => {
    // 20 x 20 RGB, Sub filtered: rows 0-9 light grey with a dark block at x 8-11, rows 10-19 the own
    // row's green with a white block there.
    const light = [220, 220, 220];
    const green = [124, 179, 66];
    const pixel = (y: number, x: number) =>
      x >= 8 && x < 12 ? (y < 10 ? [40, 40, 40] : [255, 255, 255]) : y < 10 ? light : green;
    const raw = Array.from({ length: 20 }, (_, y) => {
      const samples = Array.from({ length: 20 }, (_, x) => pixel(y, x)).flat();
      return [1, ...samples.map((v, i) => (v - (i >= 3 ? (samples[i - 3] ?? 0) : 0)) & 0xff)];
    });
    const { width, rows } = greyRows(prepareForOcr(png(20, 20, 2, Uint8Array.from(raw.flat()))));
    const [top, bottom] = [rows[TARGET_WIDTH / 4], rows[(TARGET_WIDTH * 3) / 4]];
    // The block's middle is dark and the background white, on both rows (luma alone gives the
    // white block 255 on a green of 150: lighter than its background).
    expect([top?.[width / 2], bottom?.[width / 2]].every((v) => (v ?? 255) < 128)).toBe(true);
    expect([top?.[20], bottom?.[20]].every((v) => (v ?? 0) > 240)).toBe(true);
  });

  it("drops a full-screen phone capture's status bar only when asked", () => {
    // 10 x 40 grey: taller than 1.9 times its width, so its top 5.5 % (2 rows) is the status bar.
    const rows = new Uint8Array(40 * 11).fill(200);
    const as = (statusBar: boolean) =>
      Buffer.from(prepareForOcr(png(10, 40, 0, rows), { statusBar })).readUInt32BE(20);
    expect([as(false), as(true)]).toEqual([2864, 2721]);
  });

  it("returns bytes that are not a PNG unchanged", () => {
    const jpegLike = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 6]);
    expect(prepareForOcr(jpegLike)).toBe(jpegLike);
  });

  it("refuses a PNG whose header claims more pixels than the cap, without reading its data", () => {
    const huge = png(50_000, 50_000, 0, new Uint8Array(2));
    expect(() => prepareForOcr(huge)).toThrow(ImageRefusedError);
  });

  it("refuses a narrow, tall PNG whose enlarged picture would pass the cap", () => {
    const rows = new Uint8Array(60_000 * 2);
    expect(() => prepareForOcr(png(1, 60_000, 0, rows))).toThrow(ImageRefusedError);
  });

  it("refuses a PNG with a zero width or height", () => {
    expect(() => prepareForOcr(png(0, 5, 0, new Uint8Array(0)))).toThrow(ImageRefusedError);
    expect(() => prepareForOcr(png(5, 0, 0, new Uint8Array(0)))).toThrow(ImageRefusedError);
  });

  it("refuses pixel data that inflates to more than its header allows", () => {
    expect(() => prepareForOcr(png(2, 2, 0, new Uint8Array(5_000_000)))).toThrow(ImageRefusedError);
  });
});
