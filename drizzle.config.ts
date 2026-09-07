import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";
import { existsSync } from "node:fs";

// Drizzle Kit preloads .env before evaluating this file. Explicitly override
// it with the local file when present, matching Next.js development behavior.
if (existsSync(".env.local")) {
  config({ path: ".env.local", override: true, quiet: true });
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
