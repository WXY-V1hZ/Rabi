import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { ConfigProvider, Effect, Layer, Schema } from "effect";
import { HttpRouter, HttpServer } from "effect/http";
import { HttpApiBuilder } from "effect/http-api";
import { randomBytes, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { DeviceCodeGrant, RabiApi } from "protocol";
import { expect, test } from "vitest";
import { AuthHandlers } from "../src/handlers/auth.ts";
import { DeviceHandlers } from "../src/handlers/device.ts";
import { OAuthHandlers } from "../src/handlers/oauth.ts";
import { AuthService } from "../src/services/AuthService.ts";
import { OAuthService } from "../src/services/OAuthService.ts";

const authHandlers = AuthHandlers.pipe(Layer.provide(AuthService.layer));

const postgresUrl = process.env.TEST_POSTGRES_URL;
const origin = "http://rabi.test";
const migrationsFolder = fileURLToPath(
  new URL("../db/migrations/", import.meta.url),
);

const readRegisteredUser = Schema.decodeUnknownSync(
  Schema.Struct({ user: Schema.Struct({ id: Schema.String }) }),
);
const readDeviceAuthorization = Schema.decodeUnknownSync(
  Schema.Struct({ device_code: Schema.String, user_code: Schema.String }),
);
const readExecutorCredential = Schema.decodeUnknownSync(
  Schema.Struct({
    access_token: Schema.RedactedFromValue(Schema.NonEmptyString),
    executor_id: Schema.NonEmptyString,
    expires_in: Schema.Int,
    token_type: Schema.String,
  }),
);

async function requestWithFreshHandlers(
  handlers: typeof authHandlers,
  request: Request,
) {
  const app = HttpRouter.toWebHandler(handlers, { disableLogger: true });
  try {
    const response = await app.handler(request);
    return {
      status: response.status,
      cookies: response.headers.getSetCookie(),
      body: await response.json(),
    };
  } finally {
    await app.dispose();
  }
}

test.runIf(Boolean(postgresUrl))(
  "邮箱登录的会话可在处理器重建后查询并批准设备授权，已批准申请只签发一次",
  { timeout: 30_000 },
  async () => {
    if (!postgresUrl) throw new Error("TEST_POSTGRES_URL is required");

    const databaseName = `rabi_auth_${randomUUID().replaceAll("-", "")}`;
    const databaseUrl = new URL(postgresUrl);
    databaseUrl.pathname = "/postgres";
    const admin = new Pool({ connectionString: databaseUrl.href });

    try {
      await admin.query(`CREATE DATABASE ${databaseName}`);
      try {
        databaseUrl.pathname = `/${databaseName}`;
        const pool = new Pool({ connectionString: databaseUrl.href });
        try {
          await migrate(drizzle({ client: pool }), { migrationsFolder });
        } finally {
          await pool.end();
        }

        const config = ConfigProvider.layer(
          ConfigProvider.fromUnknown({
            DATABASE_URL: databaseUrl.href,
            BETTER_AUTH_SECRET: randomBytes(32).toString("hex"),
            BETTER_AUTH_URL: origin,
          }),
        );
        const handlers = authHandlers.pipe(Layer.provide(config));
        const email = "session@example.test";
        const password = "rabi-test-password";

        const registration = await requestWithFreshHandlers(
          handlers,
          new Request(`${origin}/api/auth/sign-up/email`, {
            method: "POST",
            headers: { origin, "content-type": "application/json" },
            body: JSON.stringify({
              name: "Rabi Test",
              email,
              password,
            }),
          }),
        );
        expect(registration.status).toBe(200);
        expect(registration.cookies).not.toHaveLength(0);
        const { user } = readRegisteredUser(registration.body);

        const signIn = (password: string) =>
          requestWithFreshHandlers(
            handlers,
            new Request(`${origin}/api/auth/sign-in/email`, {
              method: "POST",
              headers: { origin, "content-type": "application/json" },
              body: JSON.stringify({ email, password }),
            }),
          );
        expect((await signIn("wrong-password")).status).toBe(401);

        const anonymous = await requestWithFreshHandlers(
          handlers,
          new Request(`${origin}/api/auth/get-session`),
        );
        expect(anonymous.status).toBe(200);
        expect(anonymous.body).toBeNull();

        const login = await signIn(password);
        expect(login.status).toBe(200);
        const cookie = login.cookies
          .map((header) => header.split(";", 1)[0])
          .join("; ");
        expect(cookie).not.toBe("");

        const session = await requestWithFreshHandlers(
          handlers,
          new Request(
            `${origin}/api/auth/get-session?disableCookieCache=true`,
            {
              headers: { cookie },
            },
          ),
        );
        expect(session.status).toBe(200);
        expect(session.body).toMatchObject({
          user: { id: user.id, email },
          session: { userId: user.id },
        });

        const [signedInUserId, anonymousUserId] = await AuthService.use(
          (auth) =>
            Effect.all([
              auth.getUserId(new Headers({ cookie })),
              auth.getUserId(new Headers()),
            ]),
        ).pipe(
          Effect.provide(AuthService.layer.pipe(Layer.provide(config))),
          Effect.runPromise,
        );
        expect(signedInUserId).toBe(user.id);
        expect(anonymousUserId).toBeNull();

        const deviceApp = HttpRouter.toWebHandler(
          HttpApiBuilder.layer(RabiApi).pipe(
            Layer.provide(Layer.mergeAll(DeviceHandlers, OAuthHandlers)),
            Layer.provide(
              Layer.mergeAll(
                AuthService.layer,
                OAuthService.layer,
                HttpServer.layerServices,
              ),
            ),
            Layer.provide(config),
          ),
          { disableLogger: true },
        );
        try {
          const post = (
            path: string,
            body: string | URLSearchParams,
            headers?: Headers,
          ) =>
            deviceApp.handler(
              new Request(`${origin}${path}`, {
                method: "POST",
                body,
                headers,
              }),
            );
          const requestAuthorization = async () => {
            const response = await post(
              "/oauth/device/code",
              new URLSearchParams({
                client_id: "rabi-cli",
                executor_identity_secret: randomBytes(32).toString("base64url"),
              }),
            );
            expect(response.status).toBe(200);
            return readDeviceAuthorization(await response.json());
          };
          const decide = (action: "approve" | "deny", userCode: string) =>
            post(
              `/api/device/${action}`,
              JSON.stringify({ userCode }),
              new Headers({
                origin,
                cookie,
                "content-type": "application/json",
              }),
            );
          const exchange = (deviceCode: string) =>
            post(
              "/oauth/token",
              new URLSearchParams({
                client_id: "rabi-cli",
                device_code: deviceCode,
                grant_type: DeviceCodeGrant,
              }),
            );

          const approved = await requestAuthorization();
          const pending = await exchange(approved.device_code);
          expect(pending.status).toBe(400);
          expect(await pending.json()).toEqual({
            error: "authorization_pending",
          });
          expect((await decide("approve", approved.user_code)).status).toBe(
            204,
          );
          expect((await decide("deny", approved.user_code)).status).toBe(409);

          const exchanges = await Promise.all([
            exchange(approved.device_code),
            exchange(approved.device_code),
          ]);
          const [first, second] = exchanges.toSorted(
            (left, right) => left.status - right.status,
          );
          expect([first.status, second.status]).toEqual([200, 400]);
          expect(readExecutorCredential(await first.json())).toMatchObject({
            token_type: "Bearer",
            expires_in: 2_592_000,
          });
          expect(await second.json()).toEqual({ error: "invalid_grant" });

          const denied = await requestAuthorization();
          expect((await decide("deny", denied.user_code)).status).toBe(204);
          const token = await exchange(denied.device_code);
          expect(token.status).toBe(400);
          expect(await token.json()).toEqual({ error: "access_denied" });
        } finally {
          await deviceApp.dispose();
        }
      } finally {
        await admin.query(`DROP DATABASE ${databaseName}`);
      }
    } finally {
      await admin.end();
    }
  },
);
