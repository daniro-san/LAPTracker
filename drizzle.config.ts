// drizzle-kit: `pnpm db:generate` writes SQL migrations to drizzle/ from lib/schema.ts (no DB connection).
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/schema.ts",
  out: "./drizzle",
});
