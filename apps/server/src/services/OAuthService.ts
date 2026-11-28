import { Context, DateTime, Duration, Effect, Layer, Redacted } from "effect";
import { createHash, randomBytes } from "node:crypto";
import { BaseError } from "protocol/errors";
import { ExecutorRegistration } from "./ExecutorRegistration.ts";

const supportedClientId = "rabi-cli";
const authorizationLifetime = Duration.seconds(60);
const pollingInterval = Duration.seconds(1);

class DeviceAuthorizationNotFound extends BaseError<"DeviceAuthorizationNotFound"> {
  constructor() {
    super("DeviceAuthorizationNotFound", "设备授权申请不存在或已过期");
  }
}

class DeviceAuthorizationAlreadyDecided extends BaseError<"DeviceAuthorizationAlreadyDecided"> {
  constructor() {
    super("DeviceAuthorizationAlreadyDecided", "设备授权申请已有决定");
  }
}

class UnsupportedOAuthClient extends BaseError<"UnsupportedOAuthClient"> {
  constructor() {
    super("UnsupportedOAuthClient", "设备授权客户端不受支持");
  }
}

class InvalidDeviceGrant extends BaseError<"InvalidDeviceGrant"> {
  constructor() {
    super("InvalidDeviceGrant", "设备码与客户端无法匹配有效授权申请");
  }
}

class DeviceAuthorizationExpired extends BaseError<"DeviceAuthorizationExpired"> {
  constructor() {
    super("DeviceAuthorizationExpired", "设备授权已过期");
  }
}

class DeviceAuthorizationDenied extends BaseError<"DeviceAuthorizationDenied"> {
  constructor() {
    super("DeviceAuthorizationDenied", "设备授权已被拒绝");
  }
}

type DeviceDecision =
  | { readonly status: "denied" }
  | { readonly status: "approved"; readonly userId: string };

type DeviceAuthorization = {
  readonly clientId: string;
  readonly userCode: string;
  readonly expiresAt: DateTime.Utc;
  readonly identitySecretDigest: string;
} & (
  | { readonly status: "pending" }
  | DeviceDecision
  | { readonly status: "consumed" }
);

const makeOAuthService = Effect.gen(function* () {
  const registration = yield* ExecutorRegistration;
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
      return yield* new DeviceAuthorizationNotFound();
    }

    const [deviceCode, authorization] = entry;
    if (DateTime.isGreaterThanOrEqualTo(now, authorization.expiresAt)) {
      return yield* new DeviceAuthorizationNotFound();
    }

    if (authorization.status !== "pending") {
      return yield* new DeviceAuthorizationAlreadyDecided();
    }

    authorizations.set(deviceCode, { ...authorization, ...decision });
  });

  const approveDeviceAuthorization = (userCode: string, userId: string) =>
    decideDeviceAuthorization(userCode, { status: "approved", userId });

  const denyDeviceAuthorization = (userCode: string) =>
    decideDeviceAuthorization(userCode, { status: "denied" });

  const requestDeviceCode = Effect.fnUntraced(function* (
    clientId: string,
    identitySecret: Redacted.Redacted<string>,
  ) {
    if (clientId !== supportedClientId) {
      return yield* new UnsupportedOAuthClient();
    }

    const now = yield* DateTime.now;
    const identitySecretDigest = createHash("sha256")
      .update(Redacted.value(identitySecret))
      .digest("hex");
    const deviceCode = randomBytes(32).toString("base64url");
    let userCode = makeUserCode();
    while (findByUserCode(userCode) !== undefined) {
      userCode = makeUserCode();
    }
    authorizations.set(deviceCode, {
      clientId,
      userCode,
      identitySecretDigest,
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
      return yield* new InvalidDeviceGrant();
    }

    if (DateTime.isGreaterThanOrEqualTo(now, authorization.expiresAt)) {
      authorizations.delete(code);
      return yield* new DeviceAuthorizationExpired();
    }

    if (authorization.status === "denied") {
      return yield* new DeviceAuthorizationDenied();
    }

    if (authorization.status === "pending") {
      return { status: "pending" } as const;
    }

    if (authorization.status === "consumed") {
      return yield* new InvalidDeviceGrant();
    }

    // 在数据库写入前占用设备码。失败时也保留消费状态，因为写入可能已提交。
    authorizations.set(code, { ...authorization, status: "consumed" });
    const credential = yield* registration.register({
      userId: authorization.userId,
      identitySecretDigest: authorization.identitySecretDigest,
    });
    return { status: "issued", ...credential } as const;
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
