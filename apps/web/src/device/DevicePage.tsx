import { useEffect, useState, type SubmitEvent } from "react";
import { readSessionEmail, signInWithEmail } from "../auth/session.ts";
import { DeviceDecisionForm } from "./DeviceDecisionForm.tsx";

type SessionState =
  | { status: "loading" | "anonymous" | "unavailable" }
  | { status: "signed-in"; email: string };

export function DevicePage() {
  const [session, setSession] = useState<SessionState>({ status: "loading" });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [userCode, setUserCode] = useState(
    () => new URLSearchParams(window.location.search).get("user_code") ?? "",
  );

  useEffect(() => {
    const controller = new AbortController();

    void readSessionEmail(controller.signal).then(
      (email) => {
        if (controller.signal.aborted) return;
        setSession(
          email === null
            ? { status: "anonymous" }
            : { status: "signed-in", email },
        );
      },
      () => {
        if (!controller.signal.aborted) setSession({ status: "unavailable" });
      },
    );

    return () => controller.abort();
  }, []);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");

    setFormError(null);
    setSubmitting(true);

    try {
      if ((await signInWithEmail(email, password)) === "invalid-credentials") {
        setFormError("邮箱或密码错误。");
        return;
      }

      const sessionEmail = await readSessionEmail();
      if (sessionEmail === null) {
        setFormError("登录后未能建立会话，请重试。");
        return;
      }

      setSession({ status: "signed-in", email: sessionEmail });
    } catch {
      setFormError("暂时无法登录，请重试。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main>
      <h1>设备授权</h1>
      {session.status === "loading" && <p role="status">正在查询登录状态…</p>}
      {session.status === "unavailable" && (
        <p role="alert">无法查询登录状态，请刷新重试。</p>
      )}
      {session.status === "signed-in" && (
        <>
          <p>当前账号：{session.email}</p>
          <DeviceDecisionForm
            userCode={userCode}
            onUserCodeChange={setUserCode}
            onSignedOut={() => {
              setFormError("登录会话已过期，请重新登录。");
              setSession({ status: "anonymous" });
            }}
          />
        </>
      )}
      {session.status === "anonymous" && (
        <form onSubmit={handleSubmit}>
          <label>
            邮箱
            <input name="email" type="email" autoComplete="username" required />
          </label>
          <label>
            密码
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          <button type="submit" disabled={submitting}>
            {submitting ? "正在登录…" : "登录"}
          </button>
          {formError && <p role="alert">{formError}</p>}
        </form>
      )}
    </main>
  );
}
