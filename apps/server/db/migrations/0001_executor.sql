CREATE TABLE "executor" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"executor_identity_secret_digest" text NOT NULL,
	"access_token_digest" text NOT NULL,
	"access_token_expires_at" timestamp with time zone NOT NULL,
	"access_token_revoked_at" timestamp with time zone,
	"unbound_at" timestamp with time zone,
	CONSTRAINT "executor_executor_identity_secret_digest_unique" UNIQUE("executor_identity_secret_digest")
);
--> statement-breakpoint
ALTER TABLE "executor" ADD CONSTRAINT "executor_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;