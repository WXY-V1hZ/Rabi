import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiSchema } from "effect/http-api";
import { OAuthErrorBody } from "../../oauth.ts";
import { snakeCaseKeys } from "../../utils.ts";

const Request = snakeCaseKeys({
  clientId: Schema.NonEmptyString,
  executorIdentitySecret: Schema.optionalKey(
    Schema.RedactedFromValue(
      Schema.String.check(Schema.isPattern(/^[A-Za-z0-9_-]{43}$/)),
    ),
  ),
  scope: Schema.optionalKey(Schema.String),
}).pipe(HttpApiSchema.asFormUrlEncoded());

const SuccessResponse = snakeCaseKeys({
  deviceCode: Schema.RedactedFromValue(Schema.NonEmptyString),
  userCode: Schema.NonEmptyString,
  verificationUri: Schema.URLFromString,
  expiresIn: Schema.Int.check(Schema.isGreaterThan(0)),
  verificationUriComplete: Schema.optionalKey(Schema.URLFromString),
  interval: Schema.optionalKey(Schema.Int.check(Schema.isGreaterThan(0))),
});

export const requestDeviceCode = HttpApiEndpoint.post(
  "requestDeviceCode",
  "/oauth/device/code",
  {
    payload: Request,
    success: SuccessResponse,
    error: OAuthErrorBody.pipe(HttpApiSchema.status(400)),
  },
);
