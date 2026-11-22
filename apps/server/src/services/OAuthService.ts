import { Context, DateTime, Duration, Effect, Layer, Redacted } from "effect";
import { randomBytes } from "node:crypto";

const supportedClientId = "rabi-cli";
const authorizationLifetime = Duration.seconds(60);
const pollingInterval = Duration.seconds(1);

interface PendingAuthorization {
  readonly clientId: string;
  readonly userCode: string;
  readonly expiresAt: DateTime.Utc;
}

const makeOAuthService = Effect.sync(() => {
  const pending = new Map<string, PendingAuthorization>();

  const requestDeviceCode = Effect.fnUntraced(function* (clientId: string) {
    if (clientId !== supportedClientId) {
      return yield* Effect.fail("invalid_client" as const);
    }

    const deviceCode = randomBytes(32).toString("base64url");
    const userCodeText = randomBytes(4).toString("hex").toUpperCase();
    const userCode = `${userCodeText.slice(0, 4)}-${userCodeText.slice(4)}`;
    const now = yield* DateTime.now;
    pending.set(deviceCode, {
      clientId,
      userCode,
      expiresAt: DateTime.addDuration(now, authorizationLifetime),
    });

    return {
      deviceCode: Redacted.make(deviceCode),
      userCode,
      expiresIn: authorizationLifetime,
      pollingInterval,
    };
  });

  const exchangeDeviceCode = Effect.fnUntraced(function* (
    clientId: string,
    deviceCode: Redacted.Redacted<string>,
  ) {
    const now = yield* DateTime.now;
    const code = Redacted.value(deviceCode);
    const authorization = pending.get(code);

    if (authorization === undefined || authorization.clientId !== clientId) {
      return yield* Effect.fail("invalid_grant" as const);
    }

    if (DateTime.isGreaterThanOrEqualTo(now, authorization.expiresAt)) {
      pending.delete(code);
      return yield* Effect.fail("expired_token" as const);
    }

    return yield* Effect.fail("authorization_pending" as const);
  });

  return { requestDeviceCode, exchangeDeviceCode };
});

export class OAuthService extends Context.Service<OAuthService>()(
  "server/services/OAuthService",
  { make: makeOAuthService },
) {
  static readonly layer = Layer.effect(OAuthService, OAuthService.make);
}
