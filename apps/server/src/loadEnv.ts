import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

const envFile = new URL("../.env", import.meta.url);

export function loadServerEnv(): void {
  if (existsSync(envFile)) loadEnvFile(envFile);
}
