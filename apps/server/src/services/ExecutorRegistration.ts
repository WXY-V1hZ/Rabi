import { drizzle } from "drizzle-orm/node-postgres";
import { Context, DateTime, Duration, Effect, Layer, Redacted } from "effect";
import { createHash, randomBytes } from "node:crypto";
import { BaseError } from "protocol/errors";
import { PostgresPool } from "../db/PostgresPools.ts";
import { executor } from "../db/schema/executor.ts";

const credentialLifetime = Duration.days(30);

class ExecutorIdentityAlreadyRegistered extends BaseError<"ExecutorIdentityAlreadyRegistered"> {
  constructor() {
    super("ExecutorIdentityAlreadyRegistered", "Executor 身份已注册");
  }
}

class ExecutorRegistrationFailed extends BaseError<"ExecutorRegistrationFailed"> {
  constructor(options: { readonly cause: unknown }) {
    super("ExecutorRegistrationFailed", "写入 Executor 注册记录失败", options);
  }
}

const digest = (secret: string) =>
  createHash("sha256").update(secret).digest("hex");

const makeExecutorRegistration = Effect.gen(function* () {
  const pool = yield* PostgresPool;
  const db = drizzle({ client: pool });

  const register = Effect.fnUntraced(function* (input: {
    readonly userId: string;
    readonly identitySecretDigest: string;
  }) {
    const now = yield* DateTime.now;
    const expiresAt = DateTime.addDuration(now, credentialLifetime);
    const accessToken = Redacted.make(randomBytes(32).toString("base64url"));
    const [row] = yield* Effect.tryPromise({
      try: () =>
        db
          .insert(executor)
          .values({
            userId: input.userId,
            executorIdentitySecretDigest: input.identitySecretDigest,
            accessTokenDigest: digest(Redacted.value(accessToken)),
            accessTokenExpiresAt: DateTime.toDateUtc(expiresAt),
          })
          .onConflictDoNothing({
            target: executor.executorIdentitySecretDigest,
          })
          .returning({ executorId: executor.id })
          .execute(),
      catch: (cause) => new ExecutorRegistrationFailed({ cause }),
    });
    if (row === undefined) {
      return yield* new ExecutorIdentityAlreadyRegistered();
    }
    return {
      executorId: row.executorId,
      accessToken,
      expiresIn: credentialLifetime,
    };
  });
  return { register };
});

export class ExecutorRegistration extends Context.Service<ExecutorRegistration>()(
  "server/services/ExecutorRegistration",
  { make: makeExecutorRegistration },
) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(PostgresPool.layer),
  );
}
