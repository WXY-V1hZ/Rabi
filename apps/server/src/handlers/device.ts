import { Effect } from "effect";
import { HttpApiBuilder, HttpApiError } from "effect/http-api";
import { RabiApi } from "protocol";
import { PublicUrl } from "../config.ts";
import { AuthService } from "../services/AuthService.ts";
import { OAuthService } from "../services/OAuthService.ts";

export const DeviceHandlers = HttpApiBuilder.group(
  RabiApi,
  "device",
  (handlers) =>
    Effect.gen(function* () {
      const auth = yield* AuthService;
      const oauth = yield* OAuthService;
      const allowedOrigin = (yield* PublicUrl).origin;

      return handlers.handle(
        "denyDeviceAuthorization",
        ({ request, payload }) =>
          Effect.gen(function* () {
            if (request.headers.origin !== allowedOrigin) {
              return yield* new HttpApiError.Forbidden();
            }

            const userId = yield* auth
              .getUserId(new Headers(request.headers))
              .pipe(
                Effect.mapError(() => new HttpApiError.InternalServerError()),
              );
            if (userId === null) {
              return yield* new HttpApiError.Unauthorized();
            }

            yield* oauth
              .denyDeviceAuthorization(payload.userCode)
              .pipe(Effect.mapError(() => new HttpApiError.NotFound()));
          }),
      );
    }),
);
