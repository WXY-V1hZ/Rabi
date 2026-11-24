import { Context, DateTime, Duration, Effect, Layer, Redacted } from "effect";
import { randomBytes } from "node:crypto";

const supportedClientId = "rabi-cli";
const authorizationLifetime = Duration.seconds(60);
const pollingInterval = Duration.seconds(1);

type DeviceDecision =
  | { readonly status: "denied" }
  | { readonly status: "approved"; readonly userId: string };

type DeviceAuthorization = {
  readonly clientId: string;
  readonly userCode: string;
  readonly expiresAt: DateTime.Utc;
} & ({ readonly status: "pending" } | DeviceDecision);

const makeOAuthService = Effect.sync(() => {
  const authorizations = new Map<string, DeviceAuthorization>();

  const findByUserCode = (userCode: string) => {
    for (const entry of authorizations) {
      if (entry[1].userCode === userCode) return entry;
    }
  };

  const makeUserCode = () => {
    const code = randomBytes(4).toString("hex").toUpperCase();
    return `${code.slice(0, 4)}-${code.slice(4)}`;
  };

  const decideDeviceAuthorization = Effect.fnUntraced(function* (
    userCode: string,
    decision: DeviceDecision,
  ) {
    const now = yield* DateTime.now;
    const entry = findByUserCode(userCode);
    if (entry === undefined) {
      return yield* Effect.fail("authorization_not_found" as const);
    }

    const [deviceCode, authorization] = entry;
    if (DateTime.isGreaterThanOrEqualTo(now, authorization.expiresAt)) {
      return yield* Effect.fail("authorization_not_found" as const);
    }

    if (authorization.status !== "pending") {
      return yield* Effect.fail("authorization_already_decided" as const);
    }

    authorizations.set(deviceCode, { ...authorization, ...decision });
  });

  const approveDeviceAuthorization = (userCode: string, userId: string) =>
    decideDeviceAuthorization(userCode, { status: "approved", userId });

  const denyDeviceAuthorization = (userCode: string) =>
    decideDeviceAuthorization(userCode, { status: "denied" });

  const requestDeviceCode = Effect.fnUntraced(function* (clientId: string) {
    if (clientId !== supportedClientId) {
      return yield* Effect.fail("invalid_client" as const);
    }

    const now = yield* DateTime.now;
    const deviceCode = randomBytes(32).toString("base64url");
    let userCode = makeUserCode();
    while (findByUserCode(userCode) !== undefined) {
      userCode = makeUserCode();
    }
    authorizations.set(deviceCode, {
      clientId,
      userCode,
      expiresAt: DateTime.addDuration(now, authorizationLifetime),
      status: "pending",
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
    const authorization = authorizations.get(code);

    if (authorization === undefined || authorization.clientId !== clientId) {
      return yield* Effect.fail("invalid_grant" as const);
    }

    if (DateTime.isGreaterThanOrEqualTo(now, authorization.expiresAt)) {
      authorizations.delete(code);
      return yield* Effect.fail("expired_token" as const);
    }

    const error =
      authorization.status === "denied"
        ? "access_denied"
        : "authorization_pending";
    return yield* Effect.fail(error);
  });

  return {
    requestDeviceCode,
    exchangeDeviceCode,
    denyDeviceAuthorization,
    approveDeviceAuthorization,
  };
});

export class OAuthService extends Context.Service<OAuthService>()(
  "server/services/OAuthService",
  { make: makeOAuthService },
) {
  static readonly layer = Layer.effect(OAuthService, OAuthService.make);
}
