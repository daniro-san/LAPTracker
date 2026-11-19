// drizzle-kit: `pnpm db:generate` writes SQL migrations to drizzle/ from the schema files (no DB connection).
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: [
    "./lib/schema.ts",
    "./lib/schema-notices.ts",
    "./lib/schema-thefts.ts",
    "./lib/schema-import.ts",
    "./lib/schema-board.ts",
    "./lib/schema-squads.ts",
    "./lib/schema-keys.ts",
    "./lib/schema-retention.ts",
    "./lib/schema-features.ts",
  ],
  out: "./drizzle",
});
