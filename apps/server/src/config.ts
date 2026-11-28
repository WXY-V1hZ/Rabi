import { Config, Effect, Redacted, Schema } from "effect";
import { randomBytes } from "node:crypto";

const isLoopback = (url: URL) =>
  ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);

const DatabaseUrlSchema = Schema.RedactedFromValue(Schema.String).check(
  Schema.makeFilter((value) => {
    const url = URL.parse(Redacted.value(value));
    return (
      (url !== null &&
        (url.protocol === "postgres:" || url.protocol === "postgresql:") &&
        url.hostname !== "") ||
      "DATABASE_URL 必须是带主机名的 PostgreSQL URL"
    );
  }),
);

const PublicUrlSchema = Schema.URL.check(
  Schema.makeFilter(
    (url: URL) =>
      url.protocol === "https:" ||
      (url.protocol === "http:" && isLoopback(url)) ||
      "BETTER_AUTH_URL 必须使用 HTTPS，本机环回地址可使用 HTTP",
  ),
);

const BetterAuthSecretSchema = Schema.RedactedFromValue(Schema.String).check(
  Schema.makeFilter(
    (value) =>
      Redacted.value(value).trim().length >= 32 ||
      "BETTER_AUTH_SECRET 至少需要 32 个字符",
  ),
);

export const DatabaseUrl = Config.schema(
  DatabaseUrlSchema,
  "DATABASE_URL",
).pipe(
  Config.withDefault(
    Redacted.make("postgresql://rabi:rabi_dev@127.0.0.1:5432/rabi"),
  ),
);

export const PublicUrl = Config.schema(PublicUrlSchema, "BETTER_AUTH_URL").pipe(
  Config.withDefault(new URL("http://127.0.0.1:5173")),
);

const BetterAuthSecret = Config.schema(
  BetterAuthSecretSchema,
  "BETTER_AUTH_SECRET",
);
const LocalBetterAuthSecret = BetterAuthSecret.pipe(
  Config.withDefault(Redacted.make(randomBytes(32).toString("hex"))),
);

export const AuthConfig = Effect.gen(function* () {
  const publicUrl = yield* PublicUrl;
  const secret = yield* isLoopback(publicUrl)
    ? LocalBetterAuthSecret
    : BetterAuthSecret;
  return { publicUrl, secret };
});
