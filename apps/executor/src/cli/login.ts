import { Console, Effect } from "effect";
import { CliError, Command } from "effect/cli";
import { OAuthService } from "../services/OAuthService.ts";

const loginErrorMessages = {
  ExecutorIdentityLoadFailed: "读取或创建 Executor 身份密钥失败",
  DeviceAuthorizationRequestFailed: "设备授权申请失败",
  DeviceAuthorizationDenied: "用户拒绝了设备授权",
  DeviceAuthorizationExpired: "设备授权已过期，请重新运行 rabi login",
  DeviceTokenExchangeFailed: "领取 Executor 凭据失败",
};

export const login = Command.make("login", {}, () => {
  return Effect.gen(function* () {
    const oauthService = yield* OAuthService;
    const executorId = yield* oauthService
      .authorize((prompt) =>
        Effect.gen(function* () {
          yield* Console.log(prompt.verificationUri);
          yield* Console.log(prompt.userCode);
        }),
      )
      .pipe(
        Effect.tapErrorTag(
          ["DeviceAuthorizationRequestFailed", "DeviceTokenExchangeFailed"],
          (error) =>
            Effect.logDebug({ _tag: error._tag, message: error.message }),
        ),
        Effect.mapError(
          (error) =>
            new CliError.UserError({
              cause: error,
              userMessage: loginErrorMessages[error._tag],
            }),
        ),
      );
    yield* Console.log(executorId);
  });
}).pipe(
  Command.withDescription("通过浏览器授权，将本地 Executor 绑定到 Rabi 账号"),
);
