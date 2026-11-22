import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/node-postgres";
import { Config, Context, Effect, Layer, Redacted } from "effect";
import { Pool } from "pg";
import { authOptions } from "../auth/options.ts";
import * as authSchema from "../db/schema/auth.ts";

const AuthConfig = Config.all({
  databaseUrl: Config.Redacted("DATABASE_URL"),
  secret: Config.Redacted("BETTER_AUTH_SECRET"),
  publicUrl: Config.URL("BETTER_AUTH_URL"),
});

const makeAuth = Effect.gen(function* () {
  const { databaseUrl, secret, publicUrl } = yield* AuthConfig;

  const pool = yield* Effect.acquireRelease(
    Effect.sync(() => {
      const pool = new Pool({
        connectionString: Redacted.value(databaseUrl),
      });
      pool.on("error", (error) => {
        console.error("PostgreSQL idle connection error", error);
      });
      return pool;
    }),
    (pool) => Effect.promise(() => pool.end()),
  );

  const db = drizzle({ client: pool, schema: authSchema });
  const auth = betterAuth({
    ...authOptions,
    baseURL: publicUrl.origin,
    secret: Redacted.value(secret),
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: authSchema,
      transaction: true,
    }),
  });

  return {
    handle: (request: Request) =>
      Effect.tryPromise(() => auth.handler(request)),
    getUserId: (headers: Headers) =>
      Effect.tryPromise(() =>
        auth.api.getSession({
          headers,
          query: { disableCookieCache: true, disableRefresh: true },
        }),
      ).pipe(Effect.map((session) => session?.user.id ?? null)),
  };
});

export class AuthService extends Context.Service<AuthService>()(
  "server/services/AuthService",
  { make: makeAuth },
) {
  static readonly layer = Layer.effect(AuthService, AuthService.make);
}
