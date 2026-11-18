import { Command, Flag } from "effect/cli";
import { Console, Effect } from "effect";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { startDeviceAuthorization } from "./login.ts";
import { FetchHttpClient } from "effect/http";

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
        return Effect.gen(function* () {
            const auth = yield* startDeviceAuthorization(options);
            yield* Console.log(`请在浏览器中打开：${auth.verificationUri}`);
            yield* Console.log(`确认码：${auth.userCode}`);
            yield* Console.log(
                `请核对确认码，并在 ${auth.expiresIn} 秒内批准绑定。`,
            );
            yield* Console.log(
                "当前步骤仅申请授权，尚未等待授权结果或保存凭据。",
            );
        }).pipe(
            Effect.catchTag("LoginError", (err) => {
                return Effect.gen(function* () {
                    yield* Console.error(err.message);
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
}).pipe(
    Effect.provide([NodeServices.layer, FetchHttpClient.layer]),
    // 拒绝重定向
    Effect.provideService(FetchHttpClient.RequestInit, { redirect: "error" }),
);

NodeRuntime.runMain(main);
