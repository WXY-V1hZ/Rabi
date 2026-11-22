import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL && existsSync(".env")) {
  loadEnvFile(".env");
}

const url = process.env.DATABASE_URL;

if (!url) {
  throw new Error("DATABASE_URL is required");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/auth.ts",
  out: "./db/migrations",
  dbCredentials: { url },
});
