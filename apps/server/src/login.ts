import { DateTime, Duration, Effect, Redacted } from "effect";
import { HttpApiBuilder } from "effect/http-api";
import { randomBytes } from "node:crypto";
import { RabiApi } from "protocol";

const clientId = "rabi-cli";
const authorizationLifetime = Duration.seconds(60);
const pollingInterval = Duration.seconds(1);
const verificationUri = new URL("http://127.0.0.1:3000/device");

interface PendingAuthorization {
  readonly clientId: string;
  readonly userCode: string;
  readonly expiresAt: DateTime.Utc;
}

export const LoginHandlers = HttpApiBuilder.group(
  RabiApi,
  "login",
  (handlers) => {
    const pending = new Map<string, PendingAuthorization>();
    return handlers.handleAll({
      requestDeviceCode: ({ payload }) =>
        Effect.gen(function* () {
          if (payload.clientId !== clientId) {
            return yield* Effect.fail({ error: "invalid_client" });
          }
          const deviceCode = randomBytes(32).toString("base64url");
          const userCodeText = randomBytes(4).toString("hex").toUpperCase();
          const userCode = `${userCodeText.slice(0, 4)}-${userCodeText.slice(4)}`;
          const now = yield* DateTime.now;
          pending.set(deviceCode, {
            clientId: payload.clientId,
            userCode,
            expiresAt: DateTime.addDuration(now, authorizationLifetime),
          });
          return {
            deviceCode: Redacted.make(deviceCode),
            userCode,
            verificationUri,
            expiresIn: Duration.toSeconds(authorizationLifetime),
            interval: Duration.toSeconds(pollingInterval),
          };
        }),
      exchangeDeviceCode: ({ payload }) =>
        Effect.gen(function* () {
          const now = yield* DateTime.now;
          const deviceCode = Redacted.value(payload.deviceCode);
          const authorization = pending.get(deviceCode);

          if (
            authorization === undefined ||
            authorization.clientId !== payload.clientId
          ) {
            return yield* Effect.fail({ error: "invalid_grant" });
          }

          if (DateTime.isGreaterThanOrEqualTo(now, authorization.expiresAt)) {
            pending.delete(deviceCode);
            return yield* Effect.fail({ error: "expired_token" });
          }

          return yield* Effect.fail({ error: "authorization_pending" });
        }),
    });
  },
);
