import { expect, it } from "@effect/vitest";
import { ConfigProvider, Effect, Redacted } from "effect";
import { AuthConfig, DatabaseUrl, PublicUrl } from "../src/config.ts";

const readAuth = (settings: Record<string, string>) =>
  AuthConfig.pipe(
    Effect.provide(ConfigProvider.layer(ConfigProvider.fromUnknown(settings))),
  );

it.effect("缺省配置指向本机并复用进程内的随机认证密钥", () =>
  Effect.gen(function* () {
    const databaseUrl = yield* DatabaseUrl.parse(
      ConfigProvider.fromUnknown({}),
    );
    const first = yield* readAuth({});
    const second = yield* readAuth({});

    expect(new URL(Redacted.value(databaseUrl)).pathname).toBe("/rabi");
    expect(first.publicUrl.origin).toBe("http://127.0.0.1:5173");
    expect(Redacted.value(first.secret)).toMatch(/^[a-f0-9]{64}$/);
    expect(Redacted.value(second.secret)).toBe(Redacted.value(first.secret));
  }),
);

it.effect("远程认证地址要求 HTTPS 和显式的认证密钥", () =>
  Effect.gen(function* () {
    const invalidUrl = yield* PublicUrl.parse(
      ConfigProvider.fromUnknown({
        BETTER_AUTH_URL: "http://rabi.example.test",
      }),
    ).pipe(Effect.flip);
    expect(invalidUrl.message).toContain("BETTER_AUTH_URL");

    const settings = { BETTER_AUTH_URL: "https://rabi.example.test" };
    const missingSecret = yield* readAuth(settings).pipe(Effect.flip);
    expect(missingSecret.message).toContain("BETTER_AUTH_SECRET");

    const secret = "synthetic-authentication-secret-for-test";
    const auth = yield* readAuth({ ...settings, BETTER_AUTH_SECRET: secret });
    expect(auth.publicUrl.origin).toBe(settings.BETTER_AUTH_URL);
    expect(Redacted.value(auth.secret)).toBe(secret);
  }),
);

it.effect("无效数据库地址和弱认证密钥报错时遮蔽输入值", () =>
  Effect.gen(function* () {
    const invalidDatabaseUrl =
      "https://user:synthetic-password@example.test/db";
    const databaseError = yield* DatabaseUrl.parse(
      ConfigProvider.fromUnknown({ DATABASE_URL: invalidDatabaseUrl }),
    ).pipe(Effect.flip);
    expect(databaseError.message).toContain("DATABASE_URL");
    expect(databaseError.message).not.toContain("synthetic-password");

    const weakSecret = "synthetic-short-secret";
    const authError = yield* readAuth({ BETTER_AUTH_SECRET: weakSecret }).pipe(
      Effect.flip,
    );
    expect(authError.message).toContain("BETTER_AUTH_SECRET");
    expect(authError.message).not.toContain(weakSecret);
  }),
);
