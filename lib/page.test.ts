// One connection per request scope (D141, 2026-11-21): an injected openDb, a memo standing in for React
// `cache` and a list of end-of-scope tasks standing in for `after`.
import { describe, expect, it, vi } from "vitest";

import { DATA_UNAVAILABLE } from "./data-unavailable";
import type { Db } from "./db";
import { scopedDb } from "./page";

/** A fresh request scope: its memo, its `after` tasks, and an openDb that counts its opens and closes. */
function scope() {
  const close = vi.fn(async () => {});
  const open = vi.fn(() => ({ db: {} as Db, close }));
  const tasks: (() => Promise<void>)[] = [];
  const memo = (first: () => Db) => {
    let kept: Db | undefined;
    return () => (kept ??= first());
  };
  const withPageDb = scopedDb(open, memo, (task) => tasks.push(task));
  const end = () => Promise.all(tasks.map((task) => task()));
  return { open, close, withPageDb, end };
}

describe("withPageDb (D141, 2026-11-21)", () => {
  it("shares one openDb between the reads of one scope and closes it once, after the scope", async () => {
    const s = scope();
    const [a, b] = await Promise.all([
      s.withPageDb(async (db) => db),
      s.withPageDb(async (db) => db),
    ]);
    expect(a).toBe(b);
    expect(s.open).toHaveBeenCalledTimes(1);
    expect(s.close).not.toHaveBeenCalled();
    await s.end();
    expect(s.close).toHaveBeenCalledTimes(1);
  });

  it("still closes once when a read throws", async () => {
    const s = scope();
    await expect(
      s.withPageDb(async () => {
        throw new Error("render failed");
      }),
    ).rejects.toThrow("render failed");
    await s.withPageDb(async (db) => db);
    await s.end();
    expect(s.open).toHaveBeenCalledTimes(1);
    expect(s.close).toHaveBeenCalledTimes(1);
  });

  it("opens nothing when the scope cannot take the close (no Next request)", async () => {
    const open = vi.fn(() => ({ db: {} as Db, close: async () => {} }));
    const withPageDb = scopedDb(
      open,
      (first) => first,
      () => {
        throw new Error("`after` was called outside a request scope");
      },
    );
    await expect(withPageDb(async (db) => db)).rejects.toThrow("outside a request scope");
    expect(open).not.toHaveBeenCalled();
  });
});

describe("a page whose database does not answer (D143)", () => {
  it("throws the digest the error page reads as data unavailable, and leaves a query error as it is", async () => {
    const s = scope();
    // What Drizzle throws when the Neon driver's WebSocket does not open, and a bad query's error.
    const refused = new Error("Failed query: select 1", { cause: new Event("error") });
    const bad = Object.assign(new Error("column does not exist"), { code: "42703" });

    await expect(s.withPageDb(() => Promise.reject(refused))).rejects.toMatchObject({
      digest: DATA_UNAVAILABLE,
      cause: refused,
    });
    await expect(s.withPageDb(() => Promise.reject(bad))).rejects.toBe(bad);
  });
});
