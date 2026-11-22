import { betterAuth } from "better-auth";
import { authOptions } from "../src/auth.ts";

export const auth = betterAuth(authOptions);
