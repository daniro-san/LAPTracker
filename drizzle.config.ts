// drizzle-kit: `pnpm db:generate` writes SQL migrations to drizzle/ from the schema files (no DB connection).
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: ["./lib/schema.ts", "./lib/schema-thefts.ts"],
  out: "./drizzle",
});
