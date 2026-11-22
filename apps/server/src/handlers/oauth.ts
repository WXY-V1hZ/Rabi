import { Duration, Effect } from "effect";
import { HttpApiBuilder } from "effect/http-api";
import { RabiApi } from "protocol";
import { OAuthService } from "../services/OAuthService.ts";

const verificationUri = new URL("http://127.0.0.1:3000/device");

export const OAuthHandlers = HttpApiBuilder.group(
  RabiApi,
  "oauth",
  (handlers) =>
    Effect.gen(function* () {
      const oauth = yield* OAuthService;

      return handlers.handleAll({
        requestDeviceCode: ({ payload: { clientId } }) =>
          oauth.requestDeviceCode(clientId).pipe(
            Effect.map(
              ({ deviceCode, userCode, expiresIn, pollingInterval }) => ({
                deviceCode,
                userCode,
                verificationUri,
                expiresIn: Duration.toSeconds(expiresIn),
                interval: Duration.toSeconds(pollingInterval),
              }),
            ),
            Effect.mapError((error) => ({ error })),
          ),
        exchangeDeviceCode: ({ payload: { clientId, deviceCode } }) =>
          oauth
            .exchangeDeviceCode(clientId, deviceCode)
            .pipe(Effect.mapError((error) => ({ error }))),
      });
    }),
);
