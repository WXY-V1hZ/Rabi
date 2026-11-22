import { betterAuth } from "better-auth";
import { authOptions } from "../src/auth-options.ts";

export const auth = betterAuth(authOptions);
