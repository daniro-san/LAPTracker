import { Worker } from "node:worker_threads";

import { describe, expect, it, vi } from "vitest";

import { screenshot } from "../screenshot/test-helpers";

// A stand-in for Tesseract.js whose thread is real: on the first job it requires a module that is not
// there, as the v5.8.1 worker did. Like Tesseract.js, the stand-in itself never answers that job.
const createWorker = vi.fn(() => {
  const thread = new Worker(
    "require('node:worker_threads').parentPort.on('message', () => { require('a-module-not-shipped'); });",
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
    const { failureCode, readUpload } = await import("./import-read");
    const { ReaderFailedError } = await import("../screenshot/read-screenshot");
    const picture = screenshot("22-donation-weekly");
    const error = await readUpload(picture).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ReaderFailedError);
    expect(failureCode("w.import.read_failed", error)).toBe(
      "w.import.read_failed:reader:MODULE_NOT_FOUND",
    );
    await expect(readUpload(picture)).rejects.toBeInstanceOf(ReaderFailedError);
    expect(createWorker).toHaveBeenCalledTimes(2);
  });
});
