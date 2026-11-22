import { expect, it } from "@effect/vitest";
import { Effect, Fiber, Layer } from "effect";
import { HttpClient, HttpServerResponse } from "effect/http";
import { TestClock } from "effect/testing";
import { OAuthService } from "../src/services/OAuthService.ts";

const startAuthorization = (
  tokenResponses: readonly HttpServerResponse.HttpServerResponse[],
) => {
  return Effect.gen(function* () {
    const exchanges = [
      {
        path: "/oauth/device/code",
        response: HttpServerResponse.jsonUnsafe({
          device_code: "test-device-code",
          user_code: "RABI-1234",
          verification_uri: "https://rabi.example.test/device",
          expires_in: 60,
          interval: 1,
        }),
      },
      ...tokenResponses.map((response) => {
        return { path: "/oauth/token", response };
      }),
    ];
    const requests: string[] = [];
    const prompts: unknown[] = [];
    const httpClient = HttpClient.make((request, url) =>
      Effect.gen(function* () {
        const exchange = exchanges.shift();
        if (exchange === undefined) {
          return yield* Effect.die(
            new Error(`意外的请求：${request.method} ${url.pathname}`),
          );
        }
        expect(request.method).toBe("POST");
        expect(url.pathname).toBe(exchange.path);
        requests.push(url.pathname);
        return HttpServerResponse.toClientResponse(exchange.response, {
          request,
        });
      }),
    );
    const oauthLayer = OAuthService.layer(
      new URL("https://rabi.example.test"),
      "rabi-cli",
    ).pipe(Layer.provide(Layer.succeed(HttpClient.HttpClient, httpClient)));
    const fiber = yield* Effect.gen(function* () {
      const service = yield* OAuthService;
      return yield* service.authorize((prompt) => {
        return Effect.sync(() => {
          prompts.push(prompt);
        });
      });
    }).pipe(Effect.provide(oauthLayer), Effect.forkChild);

    return { fiber, requests, prompts };
  });
};

it.effect.each([
  { pollingError: "authorization_pending", retryDelayMs: 1000 },
  { pollingError: "slow_down", retryDelayMs: 6000 },
])("$pollingError 后按要求继续轮询", ({ pollingError, retryDelayMs }) =>
  Effect.gen(function* () {
    const { fiber, requests, prompts } = yield* startAuthorization([
      HttpServerResponse.jsonUnsafe({ error: pollingError }, { status: 400 }),
      HttpServerResponse.jsonUnsafe({
        access_token: "test-access-token",
        token_type: "Bearer",
        expires_in: 3600,
        executor_id: "executor-test",
      }),
    ]);

    yield* TestClock.adjust(1000);
    expect(requests).toHaveLength(2);
    yield* TestClock.adjust(retryDelayMs - 1);
    expect(requests).toHaveLength(2);
    yield* TestClock.adjust(1);
    expect(requests).toHaveLength(3);
    const executorId = yield* Fiber.join(fiber);
    expect(executorId).toBe("executor-test");
    expect(prompts).toEqual([
      {
        verificationUri: "https://rabi.example.test/device",
        userCode: "RABI-1234",
      },
    ]);
  }),
);

it.effect("用户拒绝授权后停止轮询", () => {
  return Effect.gen(function* () {
    const { fiber, requests } = yield* startAuthorization([
      HttpServerResponse.jsonUnsafe(
        { error: "access_denied" },
        { status: 400 },
      ),
    ]);

    yield* TestClock.adjust("1 second");
    expect(requests).toHaveLength(2);

    yield* TestClock.adjust("60 seconds");
    const error = yield* Fiber.join(fiber).pipe(Effect.flip);

    expect(error._tag).toBe("DeviceAuthorizationDenied");
    expect(requests).toHaveLength(2);
  });
});
