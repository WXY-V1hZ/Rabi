import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth.ts";

export const executor = pgTable("executor", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  executorIdentitySecretDigest: text("executor_identity_secret_digest")
    .notNull()
    .unique(),
  accessTokenDigest: text("access_token_digest").notNull(),
  accessTokenExpiresAt: timestamp("access_token_expires_at", {
    withTimezone: true,
  }).notNull(),
  accessTokenRevokedAt: timestamp("access_token_revoked_at", {
    withTimezone: true,
  }),
  unboundAt: timestamp("unbound_at", { withTimezone: true }),
});
