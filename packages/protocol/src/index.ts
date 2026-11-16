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
    device_code: Schema.String.check(
        Schema.isBetweenLength(1, 4096),
        Schema.isPattern(/^[\x21-\x7e]+$/u),
    ),
    user_code: Schema.String.check(
        Schema.isBetweenLength(1, 128),
        Schema.isPattern(/^[\x21-\x7e]+$/u),
    ),
    verification_uri: DeviceAuthorizationUri,
    verification_uri_complete: Schema.optionalKey(DeviceAuthorizationUri),
    expires_in: PositiveSeconds,
    interval: Schema.optionalKey(PositiveSeconds),
});
