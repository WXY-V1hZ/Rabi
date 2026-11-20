import { Schema } from "effect";
import { snakeCaseKeys } from "../../utils.ts";
import { HttpApiEndpoint, HttpApiSchema } from "effect/http-api";

const Request = snakeCaseKeys({
  clientId: Schema.NonEmptyString,
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

export const OAuthErrorResponse = snakeCaseKeys({
  error: Schema.NonEmptyString,
  errorDescription: Schema.optionalKey(Schema.String),
  errorUri: Schema.optionalKey(Schema.String),
}).pipe(HttpApiSchema.status(400));

export const requestDeviceCode = HttpApiEndpoint.post(
  "requestDeviceCode",
  "/oauth/device/code",
  {
    payload: Request,
    success: SuccessResponse,
    error: OAuthErrorResponse,
  },
);
