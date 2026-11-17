import { readdirSync, readFileSync, realpathSync } from "node:fs";
import { builtinModules, createRequire } from "node:module";
import { dirname, join, matchesGlob, relative } from "node:path";

import { describe, expect, it } from "vitest";

import { OCR_ROUTES, OCR_RUNTIME } from "./next.config";

// Tracing does not follow Tesseract.js's worker thread, so next.config.ts lists what that thread
// requires (OCR_RUNTIME). v5.8.1 shipped without bmp-js and the worker died at its first require.
const root = import.meta.dirname;
const tesseract = dirname(realpathSync(join(root, "node_modules", "tesseract.js", "package.json")));
const workerScript = join(tesseract, "src", "worker-script");

/** The worker thread's .js files: the browser ones never run on the server. */
const sources = readdirSync(workerScript, { recursive: true, encoding: "utf8" })
  .filter((file) => file.endsWith(".js") && !file.startsWith("browser"))
  .map((file) => join(workerScript, file));

/** Each package a source requires by name, with the file that requires it. */
const required = sources.flatMap((file) =>
  [...readFileSync(file, "utf8").matchAll(/require\(\s*['"]([^'"./][^'"]*)['"]\s*\)/g)]
    .map((match) => match[1] ?? "")
    .filter((spec) => !builtinModules.includes(spec.replace(/^node:/, "")))
    .map((spec) => ({ file, spec, name: spec.split("/")[0] ?? "" })),
);

describe("the OCR routes' runtime (next.config.ts)", () => {
  it("covers every package the worker thread requires, where the worker resolves it", () => {
    expect(required.map((r) => r.name)).toContain("bmp-js");
    for (const { file, spec, name } of required) {
      expect(() => createRequire(file).resolve(spec), spec).not.toThrow();
      // pnpm links each dependency next to tesseract.js; the worker resolves it through that link.
      const shipped = relative(root, join(dirname(tesseract), name, "package.json"));
      const covered = OCR_RUNTIME.some((glob) => matchesGlob(shipped, glob.replace(/^\.\//, "")));
      expect(covered, `${name} (${relative(root, file)}) is not in OCR_RUNTIME`).toBe(true);
    }
  });
});

describe("the routes that read pictures (next.config.ts)", () => {
  it("ship the OCR: every route that reaches the reader is in OCR_ROUTES", () => {
    const app = join(root, "app");
    const readers = readdirSync(app, { recursive: true, encoding: "utf8" })
      .filter((f) => f.endsWith("route.ts"))
      .filter((f) => /\b(readUpload|openOcr|runJob)\b/.test(readFileSync(join(app, f), "utf8")))
      // The route's address: no route group, [slug] matched by `*`.
      .map((f) => `/${f.replace(/\/route\.ts$/, "").replace(/\([^)]*\)\//g, "")}`)
      .map((path) => path.replace(/\[[^\]]+\]/g, "x"));
    expect(readers).toHaveLength(3);
    for (const path of readers) {
      expect(
        OCR_ROUTES.some((glob) => matchesGlob(path, glob)),
        path,
      ).toBe(true);
    }
  });
});
