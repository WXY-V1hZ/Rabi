import { expect, it } from "@effect/vitest";
import {
  ConfigProvider,
  Duration,
  Effect,
  Layer,
  Logger,
  Redacted,
  Schema,
} from "effect";
import {
  HttpRouter,
  HttpServer,
  HttpServerRequest,
  HttpServerResponse,
} from "effect/http";
import { HttpApiBuilder } from "effect/http-api";
import { TestClock } from "effect/testing";
import { inspect } from "node:util";
import { DeviceCodeGrant, RabiApi } from "protocol";
import { vi } from "vitest";
import { DeviceHandlers } from "../src/handlers/device.ts";
import { OAuthHandlers } from "../src/handlers/oauth.ts";
import { AuthService } from "../src/services/AuthService.ts";
import { ExecutorRegistration } from "../src/services/ExecutorRegistration.ts";
import { OAuthService } from "../src/services/OAuthService.ts";

const origin = "https://rabi.test";
const sessionCookie = "session=test-session";
const unavailableSessionCookie = "session=unavailable-session";
const originalErrorMessage = "测试用的底层数据库诊断详情";
const lookupFailure = new Error(originalErrorMessage);
const userId = "signed-in-user";
const clientId = "rabi-cli";

vi.mock("better-auth", () => ({
  betterAuth: () => ({
    api: {
      getSession: ({ headers }: { headers: Headers }) => {
        const cookie = headers.get("cookie");
        if (cookie === unavailableSessionCookie) {
          return Promise.reject(lookupFailure);
        }
        return Promise.resolve(
          cookie === sessionCookie ? { user: { id: userId } } : null,
        );
      },
    },
  }),
}));

const configLayer = ConfigProvider.layer(
  ConfigProvider.fromUnknown({
    BETTER_AUTH_URL: origin,
    BETTER_AUTH_SECRET: "test-secret-for-device-authorization-fixture",
    DATABASE_URL: "postgresql://test:test@127.0.0.1:5432/rabi_test",
  }),
);

const readDeviceCode = Schema.decodeUnknownSync(
  Schema.Struct({
    device_code: Schema.String,
    user_code: Schema.String,
    expires_in: Schema.Int,
  }),
);

const setup = Effect.gen(function* () {
  const oauth = yield* OAuthService.make.pipe(
    Effect.provideService(ExecutorRegistration, {
      register: () => Effect.die(new Error("此用例无需签发凭据")),
    }),
  );
  const approve = vi.spyOn(oauth, "approveDeviceAuthorization");
  const handlers = Layer.mergeAll(DeviceHandlers, OAuthHandlers).pipe(
    Layer.provide(
      Layer.mergeAll(AuthService.layer, Layer.succeed(OAuthService, oauth)),
    ),
    Layer.provide(configLayer),
  );
  const app = HttpApiBuilder.layer(RabiApi).pipe(
    Layer.provide(Layer.mergeAll(handlers, HttpServer.layerServices)),
  );
  const handle = yield* HttpRouter.toHttpEffect(app);

  const post = (
    path: string,
    body: string | URLSearchParams,
    headers?: Headers,
  ) =>
    handle.pipe(
      Effect.provideService(
        HttpServerRequest.HttpServerRequest,
        HttpServerRequest.fromWeb(
          new Request(`${origin}${path}`, { method: "POST", body, headers }),
        ),
      ),
      Effect.map((response) => HttpServerResponse.toWeb(response)),
      Effect.scoped,
    );

  const requestDeviceCode = Effect.gen(function* () {
    const response = yield* post(
      "/oauth/device/code",
      new URLSearchParams({
        client_id: clientId,
        executor_identity_secret: "A".repeat(43),
      }),
    );
    expect(response.status).toBe(200);
    return readDeviceCode(yield* Effect.promise(() => response.json()));
  });

  const decide = (
    action: "approve" | "deny",
    userCode: string,
    headers: Record<string, string> = { origin, cookie: sessionCookie },
  ) => {
    const requestHeaders = new Headers(headers);
    requestHeaders.set("content-type", "application/json");
    return post(
      `/api/device/${action}`,
      JSON.stringify({ userCode }),
      requestHeaders,
    );
  };

  const poll = (deviceCode: string) =>
    post(
      "/oauth/token",
      new URLSearchParams({
        client_id: clientId,
        device_code: deviceCode,
        grant_type: DeviceCodeGrant,
      }),
    );

  return { approve, requestDeviceCode, decide, poll };
});

it.effect("批准使用当前会话的账号，后续拒绝无法覆盖批准", () =>
  Effect.gen(function* () {
    const { approve, requestDeviceCode, decide } = yield* setup;
    const { user_code: userCode } = yield* requestDeviceCode;

    expect((yield* decide("approve", userCode)).status).toBe(204);
    expect(approve).toHaveBeenCalledExactlyOnceWith(userCode, userId);
    expect((yield* decide("deny", userCode)).status).toBe(409);
  }),
);

it.effect("拒绝后无法再批准，OAuth 轮询得到 access_denied", () =>
  Effect.gen(function* () {
    const { requestDeviceCode, decide, poll } = yield* setup;
    const { user_code: userCode, device_code: deviceCode } =
      yield* requestDeviceCode;

    expect((yield* decide("deny", userCode)).status).toBe(204);
    expect((yield* decide("approve", userCode)).status).toBe(409);

    const response = yield* poll(deviceCode);
    expect(response.status).toBe(400);
    expect(yield* Effect.promise(() => response.json())).toEqual({
      error: "access_denied",
    });
  }),
);

it.effect("来源不符或缺少登录会话时，不会批准申请", () =>
  Effect.gen(function* () {
    const { approve, requestDeviceCode, decide } = yield* setup;
    const { user_code: userCode } = yield* requestDeviceCode;

    const wrongOrigin = yield* decide("approve", userCode, {
      origin: "http://other.test",
      cookie: sessionCookie,
    });
    expect(wrongOrigin.status).toBe(403);
    expect((yield* decide("approve", userCode, { origin })).status).toBe(401);
    expect(approve).not.toHaveBeenCalled();
    expect((yield* decide("approve", userCode)).status).toBe(204);
  }),
);

it.effect("会话查询失败保留经过遮蔽的原始错误", () =>
  Effect.gen(function* () {
    const error = yield* AuthService.use((auth) =>
      auth.getUserId(new Headers({ cookie: unavailableSessionCookie })),
    ).pipe(
      Effect.flip,
      Effect.provide(AuthService.layer.pipe(Layer.provide(configLayer))),
    );

    expect(error._tag).toBe("SessionLookupFailed");
    const cause = error.cause;
    if (!Redacted.isRedacted(cause)) {
      return yield* Effect.die(new Error("会话查询错误应遮蔽原始原因"));
    }
    expect(Redacted.value(cause)).toBe(lookupFailure);
    expect(JSON.stringify(error)).toContain("<redacted>");
    expect(inspect(error)).not.toContain(originalErrorMessage);
  }),
);

it.effect("会话查询失败返回通用 500，并记录一次安全诊断", () =>
  Effect.gen(function* () {
    const { approve, requestDeviceCode, decide } = yield* setup;
    const { user_code: userCode } = yield* requestDeviceCode;
    const diagnostics: Array<unknown> = [];
    const logger = Logger.make(({ logLevel, message }) => {
      if (logLevel === "Error") diagnostics.push(message);
    });

    const response = yield* decide("approve", userCode, {
      origin,
      cookie: unavailableSessionCookie,
    }).pipe(Effect.provide(Logger.layer([logger])));
    const body = yield* Effect.promise(() => response.text());

    expect(response.status).toBe(500);
    expect(body).not.toContain(originalErrorMessage);
    expect(body).not.toContain("SessionLookupFailed");
    expect(approve).not.toHaveBeenCalled();
    expect(diagnostics).toHaveLength(1);
    const renderedDiagnostics = inspect(diagnostics);
    expect(renderedDiagnostics).toContain("SessionLookupFailed");
    expect(renderedDiagnostics).toContain("读取登录会话失败");
    expect(renderedDiagnostics).not.toContain(originalErrorMessage);
  }),
);

it.effect("申请到达声明的过期时刻后无法批准", () =>
  Effect.gen(function* () {
    const { requestDeviceCode, decide } = yield* setup;
    const expired = yield* requestDeviceCode;
    yield* TestClock.adjust(Duration.millis(1));
    const valid = yield* requestDeviceCode;
    yield* TestClock.adjust(
      Duration.subtract(
        Duration.seconds(expired.expires_in),
        Duration.millis(1),
      ),
    );

    expect((yield* decide("approve", expired.user_code)).status).toBe(404);
    expect((yield* decide("approve", valid.user_code)).status).toBe(204);
  }),
);
