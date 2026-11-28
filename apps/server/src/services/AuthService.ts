import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/node-postgres";
import { Context, Effect, Layer, Redacted } from "effect";
import { BaseError } from "protocol/errors";
import { authOptions } from "../auth/options.ts";
import { AuthConfig } from "../config.ts";
import * as authSchema from "../db/schema/auth.ts";
import { PostgresPool } from "../db/PostgresPools.ts";

class AuthRequestFailed extends BaseError<"AuthRequestFailed"> {
  constructor(options: { readonly cause: unknown }) {
    super("AuthRequestFailed", "处理认证请求失败", options);
  }
}

class SessionLookupFailed extends BaseError<"SessionLookupFailed"> {
  constructor(options: { readonly cause: unknown }) {
    super("SessionLookupFailed", "读取登录会话失败", options);
  }
}

const makeAuth = Effect.gen(function* () {
  const pool = yield* PostgresPool;
  const { secret, publicUrl } = yield* AuthConfig;

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
      Effect.tryPromise({
        try: () => auth.handler(request),
        catch: (cause) => new AuthRequestFailed({ cause }),
      }),
    getUserId: (headers: Headers) =>
      Effect.tryPromise({
        try: () =>
          auth.api.getSession({
            headers,
            query: { disableCookieCache: true, disableRefresh: true },
          }),
        catch: (cause) => new SessionLookupFailed({ cause }),
      }).pipe(Effect.map((session) => session?.user.id ?? null)),
  };
});

export class AuthService extends Context.Service<AuthService>()(
  "server/services/AuthService",
  { make: makeAuth },
) {
  static readonly layer = Layer.effect(AuthService, AuthService.make).pipe(
    Layer.provide(PostgresPool.layer),
  );
}
