import { Command, Flag } from "effect/cli";
import { Console, Effect } from "effect";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { login } from "./login.ts";

const loginCommand = Command.make(
    "login",
    {
        deviceAuthorizationEndpoint: Flag.String(
            "device-authorization-endpoint",
        ).pipe(Flag.withDescription("Rabi 服务端的设备授权端点")),
        clientId: Flag.String("client-id").pipe(
            Flag.withDescription("Rabi CLI 的公开客户端标识"),
        ),
    },
    (options) => {
        return login(options).pipe(
            Effect.catchTag("LoginError", (error) => {
                return Effect.gen(function* () {
                    yield* Console.error(error.message);
                    yield* Effect.sync(() => {
                        process.exitCode = 1;
                    });
                });
            }),
        );
    },
).pipe(
    Command.withDescription("通过浏览器授权，将本地 Executor 绑定到 Rabi 账号"),
);

const rabi = Command.make("rabi").pipe(
    Command.withDescription("Rabi 本地执行器"),
    Command.withSubcommands([loginCommand]),
);

const main = Command.run(rabi, {
    version: "0.1.0",
}).pipe(Effect.provide(NodeServices.layer));

NodeRuntime.runMain(main);
