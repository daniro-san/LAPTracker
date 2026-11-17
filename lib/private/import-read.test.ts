import { Worker } from "node:worker_threads";

import { describe, expect, it, vi } from "vitest";

import { screenshot } from "../screenshot/test-helpers";

// A stand-in for Tesseract.js whose thread is real: it throws on the first job, as a worker that cannot
// load a module does. Like Tesseract.js, the stand-in itself never answers that job.
const createWorker = vi.fn(() => {
  const thread = new Worker(
    "require('node:worker_threads').parentPort.on('message', () => { throw new Error('boom'); });",
    { eval: true },
  );
  return Promise.resolve({
    setParameters: async () => ({}),
    recognize: () => {
      thread.postMessage("read");
      return new Promise(() => {});
    },
    terminate: async () => {
      await thread.terminate();
    },
  });
});

vi.mock("tesseract.js", () => ({ PSM: { SINGLE_BLOCK: "6" }, createWorker }));

describe("the shared OCR worker", () => {
  it("rejects a read when its thread dies, and the next read starts a new worker", async () => {
    const { readUpload } = await import("./import-read");
    const { ReaderFailedError } = await import("../screenshot/read-screenshot");
    const picture = screenshot("22-donation-weekly");
    await expect(readUpload(picture)).rejects.toBeInstanceOf(ReaderFailedError);
    await expect(readUpload(picture)).rejects.toBeInstanceOf(ReaderFailedError);
    expect(createWorker).toHaveBeenCalledTimes(2);
  });
});
