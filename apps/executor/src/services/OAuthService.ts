import {
  Cause,
  Context,
  Duration,
  Effect,
  Layer,
  Redacted,
  Result,
} from "effect";
import { HttpClient, HttpClientError } from "effect/http";
import { HttpApiClient } from "effect/http-api";
import { DeviceCodeGrant, RabiApi } from "protocol";
import { BaseError } from "protocol/errors";
import { ExecutorIdentityPath, ServerUrl } from "../config.ts";
import { loadExecutorIdentity } from "./ExecutorIdentity.ts";

const clientId = "rabi-cli";

class DeviceAuthorizationRequestFailed extends BaseError<"DeviceAuthorizationRequestFailed"> {
  constructor(options: { readonly cause: unknown }) {
    super("DeviceAuthorizationRequestFailed", "设备授权申请失败", options);
  }
}

class DeviceAuthorizationDenied extends BaseError<"DeviceAuthorizationDenied"> {
  constructor() {
    super("DeviceAuthorizationDenied", "用户拒绝了设备授权");
  }
}

class DeviceAuthorizationExpired extends BaseError<"DeviceAuthorizationExpired"> {
  constructor() {
    super("DeviceAuthorizationExpired", "设备授权已过期");
  }
}

class DeviceTokenExchangeFailed extends BaseError<"DeviceTokenExchangeFailed"> {
  constructor(options: { readonly cause: unknown }) {
    super("DeviceTokenExchangeFailed", "领取 Executor 凭据失败", options);
  }
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

const makeOAuthService = Effect.gen(function* () {
  const serverUrl = yield* ServerUrl;
  const identityPath = yield* ExecutorIdentityPath;
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
          return yield* new DeviceTokenExchangeFailed({ cause: error });
      }
    }
  });

  /** 展示授权网址和用户码，等待授权并返回 executorId。 */
  const authorize = Effect.fnUntraced(function* (
    showAuthorization: (prompt: AuthorizationPrompt) => Effect.Effect<void>,
  ) {
    const executorIdentitySecret = yield* loadExecutorIdentity(identityPath);
    const authorization = yield* api.oauth
      .requestDeviceCode({ payload: { clientId, executorIdentitySecret } })
      .pipe(
        Effect.mapError(
          (cause) => new DeviceAuthorizationRequestFailed({ cause }),
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
  static readonly layer = Layer.effect(OAuthService, OAuthService.make);
}
