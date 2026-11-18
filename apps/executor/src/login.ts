import { ByteSize, Data, Effect, Schema, Stream } from "effect";
import {
    DeviceAuthorizationResponse,
    DeviceAuthorizationUri,
    DeviceTokenErrorResponse,
    DeviceTokenResponse,
} from "protocol";
import { HttpClient, HttpClientError, HttpClientRequest } from "effect/http";

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

// 传入string得到函数
const decodeAuthorization = Schema.decodeUnknownEffect(
    Schema.fromJsonString(DeviceAuthorizationResponse),
);

const decodeTokenResponse = Schema.decodeUnknownEffect(
    Schema.fromJsonString(DeviceTokenResponse),
);

const decodeTokenError = Schema.decodeUnknownEffect(
    Schema.fromJsonString(DeviceTokenErrorResponse),
);

export const requestDeviceToken = Effect.fnUntraced(
    function* (tokenEndpoint: string, clientId: string, deviceCode: string) {
        const endpoint = yield* Schema.decodeUnknownEffect(
            DeviceAuthorizationUri,
        )(tokenEndpoint);

        const client = HttpClient.withScope(yield* HttpClient.HttpClient);
        const request = HttpClientRequest.post(endpoint, {
            acceptJson: true,
        }).pipe(
            HttpClientRequest.bodyUrlParams({
                grant_type: "urn:ietf:params:oauth:grant-type:device_code",
                client_id: clientId,
                device_code: deviceCode,
            }),
        );

        const response = yield* client.execute(request);

        if (response.status !== 200 && response.status !== 400) {
            return yield* new LoginError({
                message: `领取令牌失败，HTTP ${response.status}`,
            });
        }

        const contentType = response.headers["content-type"]
            ?.split(";")[0]
            ?.trim()
            .toLowerCase();

        if (contentType !== "application/json") {
            return yield* new LoginError({
                message: "令牌端点未返回 JSON",
            });
        }

        const body = yield* Stream.limitBytes<
            LoginError | HttpClientError.HttpClientError,
            never
        >(response.stream, ByteSize.kibibytes(32), () => {
            return Stream.fail(
                new LoginError({ message: "令牌响应超过大小限制" }),
            );
        }).pipe(Stream.decodeText(), Stream.mkString);

        if (response.status === 200) {
            const token = yield* decodeTokenResponse(body);
            return { _tag: "Granted" as const, token };
        } else {
            const { error } = yield* decodeTokenError(body);
            return { _tag: "OAuthError" as const, error };
        }
    },
    Effect.scoped,
    Effect.timeout("10 seconds"),
);

const requestDeviceAuthorization = Effect.fnUntraced(
    function* (endpoint: string, clientId: string) {
        // 创建httpclient
        const client = HttpClient.withScope(yield* HttpClient.HttpClient);

        // 构建请求
        const request = HttpClientRequest.post(endpoint, {
            acceptJson: true,
        }).pipe(
            HttpClientRequest.bodyUrlParams({
                client_id: clientId,
            }),
        );

        // 发送请求
        const response = yield* client.execute(request);
        if (response.status !== 200) {
            return yield* new LoginError({
                message: `申请设备授权失败，HTTP ${response.status}`,
            });
        }

        // 校验返回内容
        const contentType = response.headers["content-type"]
            ?.split(";")[0]
            ?.trim()
            .toLowerCase();
        if (contentType !== "application/json") {
            return yield* new LoginError({
                message: "授权服务未返回 JSON",
            });
        }

        // 限制响应大小
        const body = yield* Stream.limitBytes<
            LoginError | HttpClientError.HttpClientError,
            never
        >(response.stream, ByteSize.kibibytes(32), () => {
            return Stream.fail(
                new LoginError({ message: "授权服务响应超过大小限制" }),
            );
        }).pipe(Stream.decodeText(), Stream.mkString);

        return yield* decodeAuthorization(body).pipe(
            Effect.mapError(() => {
                return new LoginError({
                    message: "授权服务返回的数据不符合设备授权协议",
                });
            }),
        );
    },
    Effect.scoped,
    Effect.timeout("10 seconds"),
    Effect.catchTags({
        HttpClientError: (err) => {
            return new LoginError({
                message:
                    err.reason._tag === "EmptyBodyError"
                        ? "授权服务未返回响应内容"
                        : "申请设备授权失败，请检查网络与服务端状态",
            });
        },
        TimeoutError: () => {
            return new LoginError({ message: "申请设备授权超时" });
        },
    }),
);

export const startDeviceAuthorization = Effect.fnUntraced(function* (
    options: LoginOptions,
) {
    // 检查endpoint
    const endpoint = yield* Schema.decodeUnknownEffect(DeviceAuthorizationUri)(
        options.deviceAuthorizationEndpoint,
    ).pipe(
        Effect.mapError(() => {
            return new LoginError({
                message: "授权端点必须是有效的 HTTPS 地址",
            });
        }),
    );

    // 检查clientId
    const clientId = yield* Schema.decodeUnknownEffect(ClientId)(
        options.clientId,
    ).pipe(
        Effect.mapError(() => {
            return new LoginError({
                message: "client_id 必须是 1~256 个可打印 ASCII 字符",
            });
        }),
    );

    return yield* requestDeviceAuthorization(endpoint, clientId);
});
