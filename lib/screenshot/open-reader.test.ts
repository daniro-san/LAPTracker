import { Worker } from "node:worker_threads";

import { describe, expect, it, vi } from "vitest";

const terminate = vi.fn();
const setParameters = vi.fn();
const createWorker = vi.fn(async () => ({ setParameters, terminate }));

vi.mock("tesseract.js", () => ({ PSM: { SINGLE_BLOCK: "6" }, createWorker }));

describe("openScreenshotReader", () => {
  it("terminates the worker and rethrows when the worker refuses its settings", async () => {
    const { openScreenshotReader } = await import("./read-screenshot");
    setParameters.mockRejectedValueOnce(new Error("settings refused"));
    await expect(openScreenshotReader()).rejects.toThrow("settings refused");
    expect(terminate).toHaveBeenCalledTimes(1);
  });

  it("gives up on a worker that does not answer within CALL_MS, and terminates it", async () => {
    vi.useFakeTimers();
    const { CALL_MS, openScreenshotReader, ReaderFailedError } = await import("./read-screenshot");
    terminate.mockClear();
    setParameters.mockReturnValueOnce(new Promise(() => {}));
    const opening = expect(openScreenshotReader()).rejects.toBeInstanceOf(ReaderFailedError);
    await vi.advanceTimersByTimeAsync(CALL_MS);
    await opening;
    expect(terminate).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("stops the worker's thread when the worker fails to start", async () => {
    const { openScreenshotReader } = await import("./read-screenshot");
    let stopped: Promise<number> | undefined;
    createWorker.mockImplementationOnce(() => {
      // A live thread, as Tesseract.js's is when its core fails to load.
      const thread = new Worker("setInterval(() => {}, 1000);", { eval: true });
      stopped = new Promise((done) => thread.once("exit", done));
      return Promise.reject(new Error("core load failed"));
    });
    await expect(openScreenshotReader()).rejects.toThrow("core load failed");
    // The thread never ends by itself: it exits only because the reader stopped it.
    await expect(stopped).resolves.toBeTypeOf("number");
  });
});
