import { defineConfig } from "vitest/config";
import { loadServerEnv } from "./src/loadEnv.ts";

loadServerEnv();

export default defineConfig({});
