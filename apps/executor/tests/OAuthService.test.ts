import { NodeServices } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import { Effect, Fiber, Layer, Redacted } from "effect";
import { Command } from "effect/cli";
import { HttpClient, HttpServerResponse } from "effect/http";
import { TestClock, TestConsole } from "effect/testing";
import { login } from "../src/cli/login.ts";
import { OAuthService } from "../src/services/OAuthService.ts";

const oauthLayerFor = (httpClient: HttpClient.HttpClient) =>
  OAuthService.layer(new URL("https://rabi.example.test"), "rabi-cli").pipe(
    Layer.provide(Layer.succeed(HttpClient.HttpClient, httpClient)),
  );

const startAuthorization = (
  tokenResponses: readonly (
    | HttpServerResponse.HttpServerResponse
    | "timeout"
  )[],
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
        if (exchange.response === "timeout") return yield* Effect.never;
        return HttpServerResponse.toClientResponse(exchange.response, {
          request,
        });
      }),
    );
    const fiber = yield* Effect.gen(function* () {
      const service = yield* OAuthService;
      return yield* service.authorize((prompt) => {
        return Effect.sync(() => {
          prompts.push(prompt);
        });
      });
    }).pipe(Effect.provide(oauthLayerFor(httpClient)), Effect.forkChild);

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

it.effect("单次轮询超时后按加倍的间隔重试", () =>
  Effect.gen(function* () {
    const { fiber, requests } = yield* startAuthorization([
      "timeout",
      HttpServerResponse.jsonUnsafe({
        access_token: "test-access-token",
        token_type: "Bearer",
        expires_in: 3600,
        executor_id: "executor-test",
      }),
    ]);

    yield* TestClock.adjust("1 second");
    expect(requests).toHaveLength(2);
    yield* TestClock.adjust("10 seconds");
    yield* TestClock.adjust(1999);
    expect(requests).toHaveLength(2);
    yield* TestClock.adjust(1);

    expect(yield* Fiber.join(fiber)).toBe("executor-test");
    expect(requests).toHaveLength(3);
  }),
);

it.effect("轮询被无效授权终止时保留遮蔽的协议错误", () =>
  Effect.gen(function* () {
    const description = "synthetic upstream diagnostic";
    const { fiber, requests } = yield* startAuthorization([
      HttpServerResponse.jsonUnsafe(
        { error: "invalid_grant", error_description: description },
        { status: 400 },
      ),
    ]);

    yield* TestClock.adjust("1 second");
    const error = yield* Fiber.join(fiber).pipe(Effect.flip);

    expect(error._tag).toBe("DeviceTokenExchangeFailed");
    const cause = error.cause;
    if (!Redacted.isRedacted(cause)) {
      return yield* Effect.die(new Error("轮询错误应遮蔽原始协议响应"));
    }
    expect(Redacted.value(cause)).toMatchObject({ error: "invalid_grant" });
    expect(JSON.stringify(error)).not.toContain(description);
    expect(requests).toHaveLength(2);
  }),
);

it.effect("发起授权失败时，CLI 只输出面向用户的错误提示", () =>
  Effect.gen(function* () {
    const description = "synthetic upstream request diagnostic";
    const httpClient = HttpClient.make((request) =>
      Effect.succeed(
        HttpServerResponse.toClientResponse(
          HttpServerResponse.jsonUnsafe(
            { error: "invalid_client", error_description: description },
            { status: 400 },
          ),
          { request },
        ),
      ),
    );
    const error = yield* Command.runWith(login, { version: "0.1.0" })([]).pipe(
      Effect.provide(
        Layer.mergeAll(NodeServices.layer, oauthLayerFor(httpClient)),
      ),
      Effect.flip,
    );

    expect(error._tag).toBe("UserError");
    const output = yield* TestConsole.errorLines;
    expect(output).toHaveLength(1);
    expect(output.join("\n")).toContain("设备授权申请失败");
    expect(output.join("\n")).not.toContain(description);
  }),
);
