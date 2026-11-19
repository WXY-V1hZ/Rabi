import { Command, Flag } from "effect/cli";
import { Effect, Layer } from "effect";
import { NodeRuntime, NodeServices } from "@effect/platform-node";

const loginCommand = Command.make(
    "login",
    {
        endpoint: Flag.String("endpoint").pipe(
            Flag.withDescription("Rabi 服务端的设备授权端点"),
        ),
        clientId: Flag.String("client-id").pipe(
            Flag.withDescription("Rabi CLI 的公开客户端标识"),
        ),
    },
    (options) => {
        return Effect.gen(function* () {
            yield* Effect.logInfo(options);
        });
    },
).pipe(
    Command.withDescription("通过浏览器授权，将本地 Executor 绑定到 Rabi 账号"),
);

const rabi = Command.make("rabi").pipe(
    Command.withDescription("Rabi 本地执行器"),
    Command.withSubcommands([loginCommand]),
);

const mainLayer = Layer.mergeAll(NodeServices.layer);

const main = Command.run(rabi, {
    version: "0.1.0",
}).pipe(Effect.provide(mainLayer));

NodeRuntime.runMain(main);
