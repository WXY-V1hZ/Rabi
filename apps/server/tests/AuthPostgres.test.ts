import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { ConfigProvider, Layer, Schema } from "effect";
import { HttpRouter } from "effect/http";
import { randomBytes, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { expect, test } from "vitest";
import { AuthRoutes } from "../src/auth.ts";

const postgresUrl = process.env.TEST_POSTGRES_URL;
const origin = "http://rabi.test";
const migrationsFolder = fileURLToPath(
  new URL("../db/migrations/", import.meta.url),
);

const readRegisteredUser = Schema.decodeUnknownSync(
  Schema.Struct({ user: Schema.Struct({ id: Schema.String }) }),
);

async function requestWithFreshRoutes(
  routes: typeof AuthRoutes,
  request: Request,
) {
  const app = HttpRouter.toWebHandler(routes, { disableLogger: true });
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
  "认证路由重建后，原会话 Cookie 仍能查到同一个用户",
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
        const routes = AuthRoutes.pipe(Layer.provide(config));

        const registration = await requestWithFreshRoutes(
          routes,
          new Request(`${origin}/api/auth/sign-up/email`, {
            method: "POST",
            headers: { origin, "content-type": "application/json" },
            body: JSON.stringify({
              name: "Rabi Test",
              email: "session@example.test",
              password: "rabi-test-password",
            }),
          }),
        );
        expect(registration.status).toBe(200);
        const { user } = readRegisteredUser(registration.body);
        const cookie = registration.cookies
          .map((header) => header.split(";", 1)[0])
          .join("; ");
        expect(cookie).not.toBe("");

        const session = await requestWithFreshRoutes(
          routes,
          new Request(
            `${origin}/api/auth/get-session?disableCookieCache=true`,
            {
              headers: { cookie },
            },
          ),
        );
        expect(session.status).toBe(200);
        expect(session.body).toMatchObject({
          user: { id: user.id },
          session: { userId: user.id },
        });
      } finally {
        await admin.query(`DROP DATABASE ${databaseName}`);
      }
    } finally {
      await admin.end();
    }
  },
);
