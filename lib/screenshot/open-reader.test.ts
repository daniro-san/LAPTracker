import { describe, expect, it, vi } from "vitest";

const terminate = vi.fn();
const setParameters = vi.fn();

vi.mock("tesseract.js", () => ({
  PSM: { SINGLE_BLOCK: "6" },
  createWorker: async () => ({ setParameters, terminate }),
}));

describe("openScreenshotReader", () => {
  it("terminates the worker and rethrows when the worker refuses its settings", async () => {
    const { openScreenshotReader } = await import("./read-screenshot");
    setParameters.mockRejectedValueOnce(new Error("settings refused"));
    await expect(openScreenshotReader()).rejects.toThrow("settings refused");
    expect(terminate).toHaveBeenCalledTimes(1);
  });
});
