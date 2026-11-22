import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/node-postgres";
import { Config, Effect, Layer, Redacted } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";
import { Pool } from "pg";
import { authOptions } from "../auth/options.ts";
import * as authSchema from "../db/schema/auth.ts";

const AuthConfig = Config.all({
  databaseUrl: Config.Redacted("DATABASE_URL"),
  secret: Config.Redacted("BETTER_AUTH_SECRET"),
  publicUrl: Config.URL("BETTER_AUTH_URL"),
});

export const AuthRoutes = Layer.unwrap(
  Effect.gen(function* () {
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
    return HttpRouter.add("*", "/api/auth/*", (request) =>
      Effect.gen(function* () {
        const webRequest = yield* HttpServerRequest.toWeb(request);
        const response = yield* Effect.tryPromise(() =>
          auth.handler(webRequest),
        );
        return HttpServerResponse.fromWeb(response);
      }),
    );
  }),
);
