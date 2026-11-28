import { Duration, Effect } from "effect";
import { HttpEffect, HttpServerResponse } from "effect/http";
import { HttpApiBuilder, HttpApiError } from "effect/http-api";
import { RabiApi } from "protocol";
import { OAuthService } from "../services/OAuthService.ts";
import { PublicUrl } from "../config.ts";

export const OAuthHandlers = HttpApiBuilder.group(
  RabiApi,
  "oauth",
  (handlers) =>
    Effect.gen(function* () {
      const oauth = yield* OAuthService;
      const publicUrl = yield* PublicUrl;
      const verificationUri = new URL("/device", publicUrl);

      return handlers.handleAll({
        requestDeviceCode: ({
          payload: { clientId, executorIdentitySecret },
        }) => {
          if (executorIdentitySecret === undefined) {
            return Effect.fail({ error: "invalid_request" });
          }

          return oauth.requestDeviceCode(clientId, executorIdentitySecret).pipe(
            Effect.map(
              ({ deviceCode, userCode, expiresIn, pollingInterval }) => ({
                deviceCode,
                userCode,
                verificationUri,
                expiresIn: Duration.toSeconds(expiresIn),
                interval: Duration.toSeconds(pollingInterval),
              }),
            ),
            Effect.catchTag("UnsupportedOAuthClient", () =>
              Effect.fail({ error: "invalid_client" }),
            ),
          );
        },
        exchangeDeviceCode: ({ payload: { clientId, deviceCode } }) =>
          oauth.exchangeDeviceCode(clientId, deviceCode).pipe(
            Effect.catchTags({
              InvalidDeviceGrant: () => Effect.fail({ error: "invalid_grant" }),
              DeviceAuthorizationExpired: () =>
                Effect.fail({ error: "expired_token" }),
              DeviceAuthorizationDenied: () =>
                Effect.fail({ error: "access_denied" }),
              ExecutorIdentityAlreadyRegistered: () =>
                Effect.fail({ error: "invalid_grant" }),
              ExecutorRegistrationFailed: ({ _tag, message }) =>
                Effect.logError({ _tag, message }).pipe(
                  Effect.andThen(
                    Effect.fail(new HttpApiError.InternalServerError()),
                  ),
                ),
            }),
            Effect.flatMap(
              Effect.fnUntraced(function* (result) {
                if (result.status === "pending") {
                  return yield* Effect.fail({ error: "authorization_pending" });
                }

                yield* HttpEffect.appendPreResponseHandler(
                  (_request, response) =>
                    Effect.succeed(
                      HttpServerResponse.setHeaders(response, {
                        "cache-control": "no-store",
                        pragma: "no-cache",
                      }),
                    ),
                );
                return {
                  executorId: result.executorId,
                  accessToken: result.accessToken,
                  tokenType: "Bearer",
                  expiresIn: Duration.toSeconds(result.expiresIn),
                };
              }),
            ),
          ),
      });
    }),
);
