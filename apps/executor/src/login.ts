import { Console, Data, Effect, Schema } from "effect";
import { DeviceAuthorizationResponse, DeviceAuthorizationUri } from "protocol";

class LoginError extends Data.TaggedError("LoginError")<{
    readonly message: string;
}> {}

interface LoginOptions {
    readonly deviceAuthorizationEndpoint: string;
    readonly clientId: string;
}

const ClientId = Schema.String.check(
    Schema.isBetweenLength(1, 256),
    Schema.isPattern(/^[\x21-\x7e]+$/u),
);

const requestDeviceAuthorization = (endpoint: string, clientId: string) => {
    return Effect.tryPromise({
        try: async (signal) => {
            // 发送请求
            const response = await fetch(endpoint, {
                method: "POST",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams({
                    client_id: clientId,
                }),
                redirect: "error",
                signal,
            });

            const reader = response.body?.getReader();
            if (reader === undefined) {
                throw new LoginError({
                    message: "授权服务未返回响应内容",
                });
            }

            try {
                if (response.status !== 200) {
                    throw new LoginError({
                        message: `申请设备授权失败，HTTP ${response.status}`,
                    });
                }
                const contentType = response.headers
                    .get("content-type")
                    ?.split(";")[0]
                    ?.trim()
                    .toLowerCase();

                if (contentType !== "application/json") {
                    throw new LoginError({
                        message: "授权服务未返回 JSON",
                    });
                }

                const decoder = new TextDecoder();
                let size = 0;
                let body = "";

                while (true) {
                    const chunk = await reader.read();

                    if (chunk.done) {
                        break;
                    }

                    size += chunk.value.byteLength;

                    if (size > 32 * 1024) {
                        throw new LoginError({
                            message: "授权服务响应超过大小限制",
                        });
                    }

                    body += decoder.decode(chunk.value, {
                        stream: true,
                    });
                }

                body += decoder.decode();

                const data: unknown = JSON.parse(body);
                return data;
            } finally {
                try {
                    await reader.cancel();
                } finally {
                    reader.releaseLock();
                }
            }
        },
        catch: (error) => {
            return error instanceof LoginError
                ? error
                : new LoginError({
                      message: "申请设备授权失败，请检查网络与服务端状态",
                  });
        },
    }).pipe(
        Effect.timeout("10 seconds"),
        Effect.catchTag("TimeoutError", () => {
            return Effect.fail(
                new LoginError({
                    message: "申请设备授权超时",
                }),
            );
        }),
    );
};

export const login = (options: LoginOptions) => {
    return Effect.gen(function* () {
        // 校验URL
        const endpoint = yield* Schema.decodeUnknownEffect(
            DeviceAuthorizationUri,
        )(options.deviceAuthorizationEndpoint).pipe(
            Effect.mapError(() => {
                return new LoginError({
                    message: "授权端点必须是有效的 HTTPS 地址；",
                });
            }),
        );

        const clientId = yield* Schema.decodeUnknownEffect(ClientId)(
            options.clientId,
        ).pipe(
            Effect.mapError(() => {
                return new LoginError({
                    message: "client_id 必须是 1～256 个可打印 ASCII 字符",
                });
            }),
        );

        const data = yield* requestDeviceAuthorization(endpoint, clientId);
        const authorization = yield* Schema.decodeUnknownEffect(
            DeviceAuthorizationResponse,
        )(data).pipe(
            Effect.mapError(() => {
                return new LoginError({
                    message: "授权服务返回的数据不符合设备授权协议",
                });
            }),
        );

        yield* Console.log(
            `请在浏览器中打开：${authorization.verification_uri}`,
        );
        yield* Console.log(`确认码：${authorization.user_code}`);
        yield* Console.log(
            `请核对确认码，并在 ${authorization.expires_in} 秒内批准绑定。`,
        );
        yield* Console.log("当前步骤仅申请授权，尚未等待授权结果或保存凭据。");
    });
};
