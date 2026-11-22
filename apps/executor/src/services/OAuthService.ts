import {
  Cause,
  Context,
  Data,
  Duration,
  Effect,
  Layer,
  Redacted,
  Result,
} from "effect";
import { HttpClient, HttpClientError } from "effect/http";
import { HttpApiClient } from "effect/http-api";
import { DeviceCodeGrant, RabiApi } from "protocol";

class DeviceAuthorizationRequestFailed extends Data.TaggedError(
  "DeviceAuthorizationRequestFailed",
)<{
  readonly cause: Redacted.Redacted<unknown>;
}> {
  override readonly message = "设备授权申请失败";
}

class DeviceAuthorizationDenied extends Data.TaggedError(
  "DeviceAuthorizationDenied",
) {
  override readonly message = "用户拒绝了设备授权";
}

class DeviceAuthorizationExpired extends Data.TaggedError(
  "DeviceAuthorizationExpired",
) {
  override readonly message = "设备授权已过期，请重新运行 rabi login";
}

class DeviceTokenExchangeFailed extends Data.TaggedError(
  "DeviceTokenExchangeFailed",
)<{
  readonly cause: Redacted.Redacted<unknown>;
}> {
  override readonly message = "领取 Executor 凭据失败";
}

interface AuthorizationPrompt {
  readonly verificationUri: string;
  readonly userCode: string;
}

const isPollingTimeout = (error: unknown): boolean => {
  if (Cause.isTimeoutError(error)) return true;

  return (
    HttpClientError.isHttpClientError(error) &&
    error.reason._tag === "TransportError" &&
    Cause.isTimeoutError(error.reason.cause)
  );
};

const makeOAuthService = Effect.fnUntraced(function* (
  serverUrl: URL,
  clientId: string,
) {
  const client = yield* HttpClient.HttpClient;
  const api = yield* HttpApiClient.makeWith(RabiApi, {
    httpClient: client,
    baseUrl: serverUrl,
  });

  const pollForToken = Effect.fnUntraced(function* (
    deviceCode: Redacted.Redacted<string>,
    initialInterval: number,
  ) {
    let interval = initialInterval;
    const attempt = api.oauth
      .exchangeDeviceCode({
        payload: {
          grantType: DeviceCodeGrant,
          deviceCode,
          clientId,
        },
      })
      .pipe(Effect.timeout("10 seconds"), Effect.result);
    while (true) {
      yield* Effect.sleep(Duration.seconds(interval));
      const result = yield* attempt;
      if (Result.isSuccess(result)) return result.success;
      const error = result.failure;
      if (isPollingTimeout(error)) {
        interval *= 2;
        continue;
      }
      const code = "error" in error ? error.error : undefined;
      switch (code) {
        case "authorization_pending":
          continue;
        case "slow_down":
          interval += 5;
          continue;
        case "access_denied":
          return yield* new DeviceAuthorizationDenied();
        case "expired_token":
          return yield* new DeviceAuthorizationExpired();
        default:
          return yield* new DeviceTokenExchangeFailed({
            cause: Redacted.make(error),
          });
      }
    }
  });

  /** 展示授权网址和用户码，等待授权并返回 executorId。 */
  const authorize = Effect.fnUntraced(function* (
    showAuthorization: (prompt: AuthorizationPrompt) => Effect.Effect<void>,
  ) {
    const authorization = yield* api.oauth
      .requestDeviceCode({ payload: { clientId } })
      .pipe(
        Effect.mapError(
          (cause) =>
            new DeviceAuthorizationRequestFailed({
              cause: Redacted.make(cause),
            }),
        ),
      );
    yield* showAuthorization({
      verificationUri: authorization.verificationUri.href,
      userCode: authorization.userCode,
    });
    const token = yield* pollForToken(
      authorization.deviceCode,
      authorization.interval ?? 5,
    ).pipe(
      Effect.timeoutOrElse({
        duration: Duration.seconds(authorization.expiresIn),
        orElse: () => Effect.fail(new DeviceAuthorizationExpired()),
      }),
    );
    return token.executorId;
  });

  return { authorize };
});

export class OAuthService extends Context.Service<OAuthService>()(
  "executor/services/OAuthService",
  { make: makeOAuthService },
) {
  static readonly layer = (serverUrl: URL, clientId: string) =>
    Layer.effect(OAuthService, OAuthService.make(serverUrl, clientId));
}
