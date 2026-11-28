import { Effect, Redacted } from "effect";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { loadExecutorIdentity } from "../src/services/ExecutorIdentity.ts";

test("并发首次读取和后续读取共用同一个 Executor 身份密钥", async () => {
  const directory = await mkdtemp(join(tmpdir(), "rabi-identity-"));
  try {
    const path = join(directory, "instance", "identity");
    const [first, second] = await Promise.all([
      Effect.runPromise(loadExecutorIdentity(path)),
      Effect.runPromise(loadExecutorIdentity(path)),
    ]);
    const stored = await Effect.runPromise(loadExecutorIdentity(path));
    const secret = Redacted.value(first);

    expect(secret).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Redacted.value(second)).toBe(secret);
    expect(Redacted.value(stored)).toBe(secret);
    expect(await readFile(path, "utf8")).toBe(secret);
    if (process.platform !== "win32") {
      expect((await stat(path)).mode & 0o777).toBe(0o600);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("本地身份密钥格式错误时保留原文件", async () => {
  const directory = await mkdtemp(join(tmpdir(), "rabi-identity-"));
  try {
    const path = join(directory, "identity");
    await writeFile(path, "invalid", { mode: 0o600 });

    const error = await Effect.runPromise(
      loadExecutorIdentity(path).pipe(Effect.flip),
    );

    expect(error._tag).toBe("ExecutorIdentityLoadFailed");
    expect(await readFile(path, "utf8")).toBe("invalid");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
