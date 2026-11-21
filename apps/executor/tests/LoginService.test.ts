import { expect, it } from "@effect/vitest";
import { Clock, Effect, Fiber, Layer } from "effect";
import { HttpClient, HttpServerResponse } from "effect/http";
import { TestClock } from "effect/testing";
import {
  LoginService,
  makeLoginLayer,
  type AuthorizationPrompt,
} from "../src/service/LoginService.ts";

it.effect("授权等待中时继续轮询，批准后返回 Executor ID", () => {
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
      {
        path: "/oauth/token",
        response: HttpServerResponse.jsonUnsafe(
          { error: "authorization_pending" },
          { status: 400 },
        ),
      },
      {
        path: "/oauth/token",
        response: HttpServerResponse.jsonUnsafe({
          access_token: "test-access-token",
          token_type: "Bearer",
          expires_in: 3600,
          executor_id: "executor-test",
        }),
      },
    ];
    const requests: Array<{ path: string; at: number }> = [];
    const prompts: AuthorizationPrompt[] = [];

    const httpClient = HttpClient.make((request, url) => {
      return Effect.gen(function* () {
        const exchange = exchanges.shift();
        if (exchange === undefined) {
          return yield* Effect.die(
            new Error(`意外的请求：${request.method} ${url.pathname}`),
          );
        }

        expect(request.method).toBe("POST");
        expect(url.pathname).toBe(exchange.path);
        const at = yield* Clock.currentTimeMillis;
        requests.push({ path: url.pathname, at });

        return HttpServerResponse.toClientResponse(exchange.response, {
          request,
        });
      });
    });

    const loginLayer = makeLoginLayer(
      new URL("https://rabi.example.test"),
      "rabi-cli",
    ).pipe(Layer.provide(Layer.succeed(HttpClient.HttpClient, httpClient)));

    const fiber = yield* Effect.gen(function* () {
      const service = yield* LoginService;
      return yield* service.login((prompt) => {
        return Effect.sync(() => {
          prompts.push(prompt);
        });
      });
    }).pipe(Effect.provide(loginLayer), Effect.forkChild);

    yield* TestClock.adjust("2 seconds");

    expect(requests).toEqual([
      { path: "/oauth/device/code", at: 0 },
      { path: "/oauth/token", at: 1000 },
      { path: "/oauth/token", at: 2000 },
    ]);

    const executorId = yield* Fiber.join(fiber);
    expect(executorId).toBe("executor-test");
    expect(prompts).toEqual([
      {
        verificationUri: "https://rabi.example.test/device",
        userCode: "RABI-1234",
      },
    ]);
  });
});
