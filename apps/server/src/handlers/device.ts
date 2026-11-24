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

      const decide = (
        headers: Headers,
        userCode: string,
        action: "approve" | "deny",
      ) =>
        Effect.gen(function* () {
          if (headers.get("origin") !== allowedOrigin) {
            return yield* new HttpApiError.Forbidden();
          }

          const userId = yield* auth
            .getUserId(headers)
            .pipe(
              Effect.mapError(() => new HttpApiError.InternalServerError()),
            );
          if (userId === null) {
            return yield* new HttpApiError.Unauthorized();
          }

          const decision =
            action === "approve"
              ? oauth.approveDeviceAuthorization(userCode, userId)
              : oauth.denyDeviceAuthorization(userCode);

          yield* decision.pipe(
            Effect.mapError((error) =>
              error === "authorization_already_decided"
                ? new HttpApiError.Conflict()
                : new HttpApiError.NotFound(),
            ),
          );
        });

      return handlers.handleAll({
        approveDeviceAuthorization: ({ request, payload }) =>
          decide(new Headers(request.headers), payload.userCode, "approve"),
        denyDeviceAuthorization: ({ request, payload }) =>
          decide(new Headers(request.headers), payload.userCode, "deny"),
      });
    }),
);
