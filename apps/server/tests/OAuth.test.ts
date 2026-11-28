import { expect, it } from "@effect/vitest";
import { ConfigProvider, Duration, Effect, Layer, Redacted } from "effect";
import { HttpServer } from "effect/http";
import { HttpApiTest } from "effect/http-api";
import { TestClock } from "effect/testing";
import { DeviceCodeGrant, RabiApi } from "protocol";
import { OAuthHandlers } from "../src/handlers/oauth.ts";
import { OAuthService } from "../src/services/OAuthService.ts";

const testLayer = Layer.mergeAll(OAuthHandlers, HttpServer.layerServices).pipe(
  Layer.provide(OAuthService.layer),
  Layer.provide(
    ConfigProvider.layer(
      ConfigProvider.fromUnknown({ BETTER_AUTH_URL: "https://rabi.test" }),
    ),
  ),
);

it.effect("设备授权响应使用公开地址生成浏览器链接", () =>
  Effect.gen(function* () {
    const client = yield* HttpApiTest.groups(RabiApi, ["oauth"]);
    const authorization = yield* client.oauth.requestDeviceCode({
      payload: { clientId: "rabi-cli" },
    });

    expect(authorization.verificationUri.href).toBe("https://rabi.test/device");
  }).pipe(Effect.provide(testLayer)),
);

it.effect("发起授权和轮询时保留 OAuth 的客户端与授权错误码", () =>
  Effect.gen(function* () {
    const client = yield* HttpApiTest.groups(RabiApi, ["oauth"]);
    const unsupported = yield* client.oauth.requestDeviceCode({
      payload: { clientId: "unsupported-client" },
      responseMode: "response-only",
    });
    expect(unsupported.status).toBe(400);
    expect(yield* unsupported.json).toEqual({ error: "invalid_client" });

    const invalidGrant = yield* client.oauth.exchangeDeviceCode({
      payload: {
        clientId: "rabi-cli",
        deviceCode: Redacted.make("unissued-device-code"),
        grantType: DeviceCodeGrant,
      },
      responseMode: "response-only",
    });
    expect(invalidGrant.status).toBe(400);
    expect(yield* invalidGrant.json).toEqual({ error: "invalid_grant" });
  }).pipe(Effect.provide(testLayer)),
);

it.effect("尚未签发凭据时，设备授权服务返回等待状态", () =>
  Effect.gen(function* () {
    const oauth = yield* OAuthService;
    const clientId = "rabi-cli";
    const { deviceCode } = yield* oauth.requestDeviceCode(clientId);

    expect(yield* oauth.exchangeDeviceCode(clientId, deviceCode)).toMatchObject(
      {
        status: "pending",
      },
    );
  }).pipe(Effect.provide(OAuthService.layer)),
);

it.effect("设备码在声明的有效期结束时过期", () => {
  return Effect.gen(function* () {
    const client = yield* HttpApiTest.groups(RabiApi, ["oauth"]);
    const clientId = "rabi-cli";
    const authorization = yield* client.oauth.requestDeviceCode({
      payload: { clientId },
    });

    const poll = client.oauth.exchangeDeviceCode({
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
