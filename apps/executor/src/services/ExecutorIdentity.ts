import { Effect, Redacted, Schema } from "effect";
import { randomBytes } from "node:crypto";
import {
  link,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, join } from "node:path";
import { BaseError } from "protocol/errors";

class ExecutorIdentityLoadFailed extends BaseError<"ExecutorIdentityLoadFailed"> {
  constructor(options: { readonly cause: unknown }) {
    super(
      "ExecutorIdentityLoadFailed",
      "读取或创建 Executor 身份密钥失败",
      options,
    );
  }
}

const decodeIdentitySecret = Schema.decodeUnknownSync(
  Schema.String.check(Schema.isPattern(/^[A-Za-z0-9_-]{43}$/)),
);

const hasErrorCode = (cause: unknown, code: string): boolean =>
  typeof cause === "object" &&
  cause !== null &&
  "code" in cause &&
  cause.code === code;

async function readOrCreateIdentitySecret(identityPath: string) {
  try {
    return await readFile(identityPath, "utf8");
  } catch (cause) {
    if (!hasErrorCode(cause, "ENOENT")) throw cause;
  }

  const directory = dirname(identityPath);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const stagingDirectory = await mkdtemp(join(directory, ".identity-"));

  try {
    const secret = randomBytes(32).toString("base64url");
    const stagingPath = join(stagingDirectory, "secret");
    await writeFile(stagingPath, secret, { mode: 0o600, flush: true });

    try {
      await link(stagingPath, identityPath);
      return secret;
    } catch (cause) {
      if (!hasErrorCode(cause, "EEXIST")) throw cause;
      return await readFile(identityPath, "utf8");
    }
  } finally {
    await rm(stagingDirectory, { recursive: true, force: true });
  }
}

export const loadExecutorIdentity = (identityPath: string) =>
  Effect.tryPromise({
    try: async () =>
      Redacted.make(
        decodeIdentitySecret(await readOrCreateIdentitySecret(identityPath)),
      ),
    catch: (cause) => new ExecutorIdentityLoadFailed({ cause }),
  });
