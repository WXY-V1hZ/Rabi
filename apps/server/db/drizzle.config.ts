import { defineConfig } from "drizzle-kit";
import { Effect, Redacted } from "effect";
import { DatabaseUrl } from "../src/config.ts";
import { loadServerEnv } from "../src/loadEnv.ts";

loadServerEnv();

const url = Redacted.value(Effect.runSync(DatabaseUrl));

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/auth.ts",
  out: "./db/migrations",
  dbCredentials: { url },
});
