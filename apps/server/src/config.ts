import { Config } from "effect";

export const DatabaseUrl = Config.Redacted("DATABASE_URL");
export const BetterAuthSecret = Config.Redacted("BETTER_AUTH_SECRET");
export const PublicUrl = Config.URL("BETTER_AUTH_URL");
