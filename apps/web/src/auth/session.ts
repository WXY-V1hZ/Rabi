export async function readSessionEmail(
  signal?: AbortSignal,
): Promise<string | null> {
  const response = await fetch("/api/auth/get-session", { signal });
  if (!response.ok) throw new Error("无法查询登录状态");

  const session: unknown = await response.json();
  if (session === null) return null;

  if (typeof session === "object" && "user" in session) {
    const { user } = session;
    if (
      typeof user === "object" &&
      user !== null &&
      "email" in user &&
      typeof user.email === "string"
    ) {
      return user.email;
    }
  }

  throw new Error("无法读取登录账号");
}

export async function signInWithEmail(email: string, password: string) {
  const response = await fetch("/api/auth/sign-in/email", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (response.status === 401) return "invalid-credentials";
  if (!response.ok) throw new Error("暂时无法登录");
  return "signed-in";
}
