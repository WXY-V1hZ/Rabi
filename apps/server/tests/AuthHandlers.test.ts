import { expect, it } from "@effect/vitest";
import { ConfigProvider, Effect, Layer, Logger } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";
import { inspect } from "node:util";
import { vi } from "vitest";
import { AuthHandlers } from "../src/handlers/auth.ts";
import { AuthService } from "../src/services/AuthService.ts";

const origin = "https://rabi.test";
const privateDetail = "synthetic auth dependency diagnostic";

vi.mock("better-auth", () => ({
  betterAuth: () => ({
    handler: (request: Request) => {
      if (new URL(request.url).pathname === "/api/auth/rejected") {
        return Promise.reject(new Error(privateDetail));
      }
      return Promise.resolve(
        Response.json({ code: "INVALID_CREDENTIALS" }, { status: 401 }),
      );
    },
  }),
}));

const app = AuthHandlers.pipe(
  Layer.provide(AuthService.layer),
  Layer.provide(
    ConfigProvider.layer(
      ConfigProvider.fromUnknown({
        BETTER_AUTH_URL: origin,
        BETTER_AUTH_SECRET: "test-secret-for-auth-handler-fixture",
        DATABASE_URL: "postgresql://test:test@127.0.0.1:5432/rabi_test",
      }),
    ),
  ),
);

it.effect("认证端点透传库响应，并安全处理库抛出的故障", () =>
  Effect.gen(function* () {
    const handle = yield* HttpRouter.toHttpEffect(app);
    const request = (path: string) =>
      handle.pipe(
        Effect.provideService(
          HttpServerRequest.HttpServerRequest,
          HttpServerRequest.fromWeb(new Request(`${origin}/api/auth/${path}`)),
        ),
        Effect.map((response) => HttpServerResponse.toWeb(response)),
        Effect.scoped,
      );

    const diagnostics: Array<unknown> = [];
    const logger = Logger.layer([
      Logger.make(({ logLevel, message }) => {
        if (logLevel === "Error") diagnostics.push(message);
      }),
    ]);

    const handled = yield* request("sign-in").pipe(Effect.provide(logger));
    expect(handled.status).toBe(401);
    expect(yield* Effect.promise(() => handled.json())).toEqual({
      code: "INVALID_CREDENTIALS",
    });
    expect(diagnostics).toHaveLength(0);

    const rejected = yield* request("rejected").pipe(Effect.provide(logger));
    expect(rejected.status).toBe(500);
    expect(yield* Effect.promise(() => rejected.text())).toBe("");
    expect(diagnostics).toHaveLength(1);
    const rendered = inspect(diagnostics);
    expect(rendered).toContain("AuthRequestFailed");
    expect(rendered).not.toContain(privateDetail);
  }),
);
