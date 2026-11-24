import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiError, HttpApiSchema } from "effect/http-api";

export const denyDeviceAuthorization = HttpApiEndpoint.post(
  "denyDeviceAuthorization",
  "/api/device/deny",
  {
    payload: Schema.Struct({
      userCode: Schema.String.check(
        Schema.isPattern(/^[0-9A-F]{4}-[0-9A-F]{4}$/),
      ),
    }),
    success: HttpApiSchema.NoContent,
    error: [
      HttpApiError.Forbidden,
      HttpApiError.Unauthorized,
      HttpApiError.NotFound,
      HttpApiError.Conflict,
      HttpApiError.InternalServerError,
    ],
  },
);
