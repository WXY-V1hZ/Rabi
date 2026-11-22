import { defineConfig } from "drizzle-kit";
import { loadServerEnv } from "../src/loadEnv.ts";

loadServerEnv();

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
