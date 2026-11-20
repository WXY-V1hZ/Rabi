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

export interface AuthorizationPrompt {
  readonly verificationUri: string;
  readonly userCode: string;
}

export class LoginService extends Context.Service<
  LoginService,
  {
    /**
     * @param showAuthorization 外部回调，向用户展示授权网址和登录码
     * @returns executorId
     */
    login(
      showAuthorization: (prompt: AuthorizationPrompt) => Effect.Effect<void>,
    ): Effect.Effect<string, Error>;
  }
>()("LoginService") {}

const isPollingTimeout = (error: unknown): boolean => {
  if (Cause.isTimeoutError(error)) return true;

  return (
    HttpClientError.isHttpClientError(error) &&
    error.reason._tag === "TransportError" &&
    Cause.isTimeoutError(error.reason.cause)
  );
};

export const makeLoginLayer = (serverUrl: URL, clientId: string) =>
  Layer.effect(
    LoginService,
    Effect.gen(function* () {
      const client = yield* HttpClient.HttpClient;
      const api = yield* HttpApiClient.makeWith(RabiApi, {
        httpClient: client,
        baseUrl: serverUrl,
      });
      const pollForToken = (
        deviceCode: Redacted.Redacted<string>,
        initialInterval: number,
      ) =>
        Effect.gen(function* () {
          let interval = initialInterval;
          const attempt = api.login
            .exchangeDeviceCode({
              payload: {
                grantType: DeviceCodeGrant,
                deviceCode,
                clientId,
              },
            })
            .pipe(Effect.timeout("10 seconds"), Effect.result);
          // 循环请求
          while (true) {
            yield* Effect.sleep(Duration.seconds(interval));
            const result = yield* attempt;
            // 成功直接返回
            if (Result.isSuccess(result)) return result.success;
            // 失败
            const error = result.failure;
            // 指数退避
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
                return yield* Effect.fail(new Error("用户拒绝了设备授权"));
              case "expired_token":
                return yield* Effect.fail(
                  new Error("设备授权已过期，请重新运行 rabi login"),
                );
              default:
                return yield* Effect.fail(new Error("领取 Executor 凭据失败"));
            }
          }
        });
      return LoginService.of({
        login: (showAuthorization) =>
          Effect.gen(function* () {
            // 发送请求
            const authorization = yield* api.login
              .requestDeviceCode({ payload: { clientId } })
              .pipe(Effect.mapError(() => new Error("设备授权申请失败")));
            // 打印输出
            yield* showAuthorization({
              verificationUri: authorization.verificationUri.href,
              userCode: authorization.userCode,
            });
            // 轮询获取token
            const token = yield* pollForToken(
              authorization.deviceCode,
              authorization.interval ?? 5,
            ).pipe(
              Effect.timeoutOrElse({
                duration: Duration.seconds(authorization.expiresIn),
                orElse: () =>
                  Effect.fail(
                    new Error("设备授权已过期，请重新运行 rabi login"),
                  ),
              }),
            );
            return token.executorId;
          }),
      });
    }),
  );
