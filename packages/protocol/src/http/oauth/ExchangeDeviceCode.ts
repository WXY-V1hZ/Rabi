import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiError, HttpApiSchema } from "effect/http-api";
import { DeviceCodeGrant, OAuthErrorBody } from "../../oauth.ts";
import { snakeCaseKeys } from "../../utils.ts";

const Request = snakeCaseKeys({
  grantType: Schema.Literal(DeviceCodeGrant),
  deviceCode: Schema.RedactedFromValue(Schema.NonEmptyString),
  clientId: Schema.NonEmptyString,
}).pipe(HttpApiSchema.asFormUrlEncoded());

const SuccessResponse = snakeCaseKeys({
  accessToken: Schema.RedactedFromValue(Schema.NonEmptyString),
  tokenType: Schema.String.check(Schema.isPattern(/^Bearer$/i)),
  expiresIn: Schema.Int.check(Schema.isGreaterThan(0)),
  executorId: Schema.NonEmptyString,
  scope: Schema.optionalKey(Schema.String),
});

export const exchangeDeviceCode = HttpApiEndpoint.post(
  "exchangeDeviceCode",
  "/oauth/token",
  {
    payload: Request,
    success: SuccessResponse,
    error: [
      OAuthErrorBody.pipe(HttpApiSchema.status(400)),
      HttpApiError.InternalServerErrorNoContent,
    ],
  },
);
