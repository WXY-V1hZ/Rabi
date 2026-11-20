import { Console, Effect } from "effect";
import { Command } from "effect/cli";
import { LoginService } from "../service/LoginService.ts";

export const login = Command.make("login", {}, () => {
  return Effect.gen(function* () {
    const loginService = yield* LoginService;
    const executorId = yield* loginService.login((prompt) =>
      Effect.gen(function* () {
        yield* Console.log(prompt.verificationUri);
        yield* Console.log(prompt.userCode);
      }),
    );
    yield* Console.log(executorId);
  });
}).pipe(
  Command.withDescription("通过浏览器授权，将本地 Executor 绑定到 Rabi 账号"),
);
