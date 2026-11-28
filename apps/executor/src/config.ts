import { Config, Schema } from "effect";
import { homedir } from "node:os";
import { join } from "node:path";

const ServerUrlSchema = Schema.URL.check(
  Schema.makeFilter(
    (url: URL) =>
      url.protocol === "https:" ||
      (url.protocol === "http:" &&
        ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) ||
      "RABI_SERVER_URL 必须使用 HTTPS，本机环回地址可使用 HTTP",
  ),
);

export const ServerUrl = Config.schema(ServerUrlSchema, "RABI_SERVER_URL").pipe(
  Config.withDefault(new URL("http://127.0.0.1:3000")),
);

export const ExecutorIdentityPath = Config.schema(
  Schema.NonEmptyString,
  "RABI_EXECUTOR_IDENTITY_PATH",
).pipe(
  Config.withDefault(
    join(homedir(), ".config", "rabi", "executor", "identity-secret"),
  ),
);
