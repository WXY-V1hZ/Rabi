import { Schema } from "effect";

export const DeviceAuthorizationUri = Schema.String.check(
    Schema.isBetweenLength(1, 4096),
    Schema.makeFilter((value) => {
        // oxlint-disable-next-line no-control-regex
        if (/[\u0000-\u0020\u007f]/u.test(value)) {
            return "授权地址不能包含空白或控制字符";
        }

        try {
            const url = new URL(value);
            const isLocalhost = ["localhost", "127.0.0.1", "[::1]"].includes(
                url.hostname,
            );
            const isSecure =
                url.protocol === "https:" ||
                (url.protocol === "http:" && isLocalhost);

            return (
                (isSecure &&
                    url.username === "" &&
                    url.password === "" &&
                    url.hash === "") ||
                "授权地址必须使用 HTTPS；本地开发允许 localhost HTTP"
            );
        } catch {
            return "授权地址必须是绝对 URL";
        }
    }),
);

const PositiveSeconds = Schema.Number.check(
    Schema.isInt(),
    Schema.isBetween({
        minimum: 1,
        maximum: Number.MAX_SAFE_INTEGER,
    }),
);

export const DeviceAuthorizationResponse = Schema.Struct({
    deviceCode: Schema.String.check(
        Schema.isBetweenLength(1, 4096),
        Schema.isPattern(/^[\x21-\x7e]+$/u),
    ),
    userCode: Schema.String.check(
        Schema.isBetweenLength(1, 128),
        Schema.isPattern(/^[\x21-\x7e]+$/u),
    ),
    verificationUri: DeviceAuthorizationUri,
    verificationUriComplete: Schema.optionalKey(DeviceAuthorizationUri),
    expiresIn: PositiveSeconds,
    interval: Schema.optionalKey(PositiveSeconds),
}).pipe(
    Schema.encodeKeys({
        deviceCode: "device_code",
        userCode: "user_code",
        verificationUri: "verification_uri",
        verificationUriComplete: "verification_uri_complete",
        expiresIn: "expires_in",
    }),
);

const TokenValue = Schema.RedactedFromValue(Schema.NonEmptyString);

export const DeviceTokenResponse = Schema.Struct({
    accessToken: TokenValue,
    tokenType: Schema.NonEmptyString,
    expiresIn: Schema.optionalKey(
        Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
    ),
    refreshToken: Schema.optionalKey(TokenValue),
    scope: Schema.optionalKey(Schema.NonEmptyString),
}).pipe(
    Schema.encodeKeys({
        accessToken: "access_token",
        tokenType: "token_type",
        expiresIn: "expires_in",
        refreshToken: "refresh_token",
    }),
);

export const DeviceTokenErrorResponse = Schema.Struct({
    error: Schema.NonEmptyString,
});
