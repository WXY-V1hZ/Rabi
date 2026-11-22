import type { BetterAuthOptions } from "better-auth";

export const authOptions = {
  baseURL: "http://127.0.0.1:3000",
  emailAndPassword: { enabled: true },
} satisfies BetterAuthOptions;
