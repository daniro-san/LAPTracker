// `pnpm db:migrate`: apply drizzle/ to the database behind DATABASE_URL_UNPOOLED (or DATABASE_URL).
// Vercel runs it before every build (vercel.json buildCommand), so each environment migrates its own
// Neon branch (plan §3.2). Uses the neon-http driver on purpose: plain HTTPS, no WebSocket — the
// drizzle-kit CLI picked @neondatabase/serverless over a WebSocket and failed in Vercel's build
// container (PR #19). The runtime keeps its WebSocket Pool (lib/db.ts); migrations don't need it.
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) {
  console.error("db:migrate: DATABASE_URL_UNPOOLED (or DATABASE_URL) is required");
  process.exit(2);
}

const db = drizzle(neon(url));
const started = Date.now();
await migrate(db, { migrationsFolder: "drizzle" });
console.log(`db:migrate: drizzle/ applied in ${Date.now() - started} ms`);
