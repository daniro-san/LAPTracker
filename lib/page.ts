// What a server-rendered page needs (the page twin of route.ts's withContext). Every withPageDb in one
// request (page, layout, the desk frame's status bar, the upstream banner, metadata) shares one Pool, kept
// with React `cache` and closed once by `after`, when the response is done: streamed Suspense parts and a
// render that throws included (D141, 2026-11-21). Errors propagate to Next, whose onRequestError records
// them. A read that can outlive the request (a shared-cache loader Next may run in the background, anything
// run from `after`) takes withOwnDb: a connection of its own, closed when the read returns.
import { after } from "next/server";
import { cache } from "react";

import { getAppContext } from "./app-context";
import type { Db } from "./db";

type Opened = { db: Db; close: () => Promise<void> };

/**
 * withPageDb over one request scope: `memo` keeps the scope's one connection, `atEnd` runs its close once
 * when the scope ends. The close is registered before the Pool exists, so a scope that cannot register
 * one opens nothing.
 */
export function scopedDb(
  open: () => Opened,
  memo: (first: () => Db) => () => Db,
  atEnd: (task: () => Promise<void>) => void,
) {
  const db = memo(() => {
    let close = async () => {};
    atEnd(() => close());
    const opened = open();
    close = opened.close;
    return opened.db;
  });
  return async <T>(read: (db: Db) => Promise<T>): Promise<T> => read(db());
}

/**
 * The request's Pool (QA of perf Batch 3): at most 3 connections, and an idle one closes after 200 ms instead
 * of staying open until `after`. With the driver's 10 and 10 s, 20 requests at once held 89 Postgres
 * connections where separate Pools had held 44–56, and 39 at once hit `max_connections`. With 3 and 200 ms:
 * 47, and no refusal.
 */
const REQUEST_POOL = { max: 3, idleTimeoutMillis: 200 };

export const withPageDb = scopedDb(() => getAppContext().openDb(REQUEST_POOL), cache, after);

/** A connection of its own, closed when `read` returns: for reads that may run after the request. */
export async function withOwnDb<T>(read: (db: Db) => Promise<T>): Promise<T> {
  const { db, close } = getAppContext().openDb();
  try {
    return await read(db);
  } finally {
    await close();
  }
}
