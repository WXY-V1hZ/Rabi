import { Context, Duration, Effect, Layer, Redacted, Schema } from "effect";
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/http";
import { AuthResponse, TokenResponse } from "protocol";

export interface AuthorizationPrompt {
  readonly verificationUri: string;
  readonly userCode: string;
}

export class LoginService extends Context.Service<
  LoginService,
  {
    /**
     * @param showAuthorization 外部回调，用于向用户展示授权信息
     * @returns executorId
     */
    login(
      showAuthorization: (prompt: AuthorizationPrompt) => Effect.Effect<void>,
    ): Effect.Effect<string, Error>;
  }
>()("LoginService") {}

export const makeLoginLayer = (serverUrl: URL, clientId: string) =>
  Layer.effect(
    LoginService,
    Effect.gen(function* () {
      const client = yield* HttpClient.HttpClient;
      return LoginService.of({
        login: (showAuthorization) =>
          Effect.gen(function* () {
            // 构造请求
            const request = HttpClientRequest.post(
              new URL("/oauth/device/code", serverUrl),
            ).pipe(
              HttpClientRequest.bodyUrlParams({
                client_id: clientId,
              }),
            );
            // 发送请求
            const authorization = yield* client.execute(request).pipe(
              Effect.flatMap(HttpClientResponse.filterStatusOk),
              Effect.flatMap((response) => response.text),
              Effect.flatMap(Schema.decodeUnknownEffect(AuthResponse)),
              Effect.mapError(() => new Error("设备授权申请失败")),
            );
            // 打印输出
            yield* showAuthorization({
              verificationUri: authorization.verificationUri.href,
              userCode: authorization.userCode,
            });
            // 等待轮询时间
            yield* Effect.sleep(Duration.seconds(authorization.interval ?? 5));
            // 请求获得token
            const tokenRequest = HttpClientRequest.post(
              new URL("/oauth/token", serverUrl),
            ).pipe(
              HttpClientRequest.bodyUrlParams({
                grant_type: "urn:ietf:params:oauth:grant-type:device_code",
                device_code: Redacted.value(authorization.deviceCode),
                client_id: clientId,
              }),
            );
            const token = yield* client.execute(tokenRequest).pipe(
              Effect.flatMap(HttpClientResponse.filterStatusOk),
              Effect.flatMap((response) => response.text),
              Effect.flatMap(Schema.decodeUnknownEffect(TokenResponse)),
              Effect.mapError(() => new Error("领取 Executor 凭据失败")),
            );
            return token.executorId;
          }),
      });
    }),
  );
