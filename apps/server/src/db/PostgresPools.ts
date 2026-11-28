import { Context, Effect, Layer, Redacted } from "effect";
import { Pool } from "pg";
import { BaseError } from "protocol/errors";
import { DatabaseUrl } from "../config.ts";

class IdleDatabaseConnectionFailed extends BaseError<"IdleDatabaseConnectionFailed"> {
  constructor(options: { readonly cause: unknown }) {
    super("IdleDatabaseConnectionFailed", "PostgreSQL 空闲连接故障", options);
  }
}

export class PostgresPool extends Context.Service<PostgresPool, Pool>()(
  "server/db/PostgresPool",
) {
  static readonly layer = Layer.effect(
    PostgresPool,
    Effect.gen(function* () {
      const databaseUrl = yield* DatabaseUrl;
      return yield* Effect.acquireRelease(
        Effect.sync(() => {
          const pool = new Pool({
            connectionString: Redacted.value(databaseUrl),
          });
          pool.on("error", (cause) => {
            const error = new IdleDatabaseConnectionFailed({ cause });
            console.error({ _tag: error._tag, message: error.message });
          });
          return pool;
        }),
        (pool) => Effect.promise(() => pool.end()),
      );
    }),
  );
}
