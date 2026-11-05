// What a server-rendered page needs: one DB connection per render, closed on every path (the page
// twin of route.ts's withContext). Errors propagate to Next, whose onRequestError records them.
import { getAppContext } from "./app-context";
import type { Db } from "./db";

export async function withPageDb<T>(read: (db: Db) => Promise<T>): Promise<T> {
  const { db, close } = getAppContext().openDb();
  try {
    return await read(db);
  } finally {
    await close();
  }
}
