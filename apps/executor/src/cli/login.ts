import { Console, Effect } from "effect";
import { CliError, Command } from "effect/cli";
import { OAuthService } from "../services/OAuthService.ts";

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
        Effect.mapError(
          (error) =>
            new CliError.UserError({
              cause: error,
              userMessage: error.message,
            }),
        ),
      );
    yield* Console.log(executorId);
  });
}).pipe(
  Command.withDescription("通过浏览器授权，将本地 Executor 绑定到 Rabi 账号"),
);
