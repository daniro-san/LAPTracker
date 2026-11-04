// drizzle-kit: `pnpm db:generate` writes SQL migrations to drizzle/ from lib/schema.ts (no DB
// connection). `pnpm db:migrate` applies drizzle/ to the database behind DATABASE_URL_UNPOOLED —
// the direct (non-pooled) connection, which is what DDL wants. Vercel runs it before every build
// (vercel.json buildCommand), so each environment migrates its own branch (plan §3.2).
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "" },
});
