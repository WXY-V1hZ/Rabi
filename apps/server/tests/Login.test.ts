import { expect, it } from "@effect/vitest";
import { Duration, Effect, Layer } from "effect";
import { HttpServer } from "effect/http";
import { HttpApiTest } from "effect/http-api";
import { TestClock } from "effect/testing";
import { DeviceCodeGrant, RabiApi } from "protocol";
import { LoginHandlers } from "../src/login.ts";

const testLayer = Layer.mergeAll(LoginHandlers, HttpServer.layerServices);

it.effect("设备码在声明的有效期结束时过期", () => {
  return Effect.gen(function* () {
    const client = yield* HttpApiTest.groups(RabiApi, ["login"]);
    const clientId = "rabi-cli";
    const authorization = yield* client.login.requestDeviceCode({
      payload: { clientId },
    });

    const poll = client.login.exchangeDeviceCode({
      payload: {
        clientId,
        deviceCode: authorization.deviceCode,
        grantType: DeviceCodeGrant,
      },
      responseMode: "response-only",
    });

    const lastMillisecond = Duration.millis(1);
    yield* TestClock.adjust(
      Duration.subtract(
        Duration.seconds(authorization.expiresIn),
        lastMillisecond,
      ),
    );

    const before = yield* poll;
    expect(before.status).toBe(400);
    expect(yield* before.json).toEqual({ error: "authorization_pending" });

    yield* TestClock.adjust(lastMillisecond);

    const atExpiry = yield* poll;
    expect(atExpiry.status).toBe(400);
    expect(yield* atExpiry.json).toEqual({ error: "expired_token" });
  }).pipe(Effect.provide(testLayer));
});
