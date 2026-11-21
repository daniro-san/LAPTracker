CREATE TABLE "push_marks" (
	"workspace_id" integer NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"sent_at" timestamp with time zone NOT NULL,
	CONSTRAINT "push_marks_workspace_id_key_pk" PRIMARY KEY("workspace_id","key")
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"workspace_id" integer NOT NULL,
	"workspace_user_id" integer NOT NULL,
	"endpoint_hash" text NOT NULL,
	"ciphertext" text NOT NULL,
	"nonce" text NOT NULL,
	"master_fp" text NOT NULL,
	"uses" text[] NOT NULL,
	"language" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"last_success_at" timestamp with time zone,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("workspace_id","endpoint_hash"),
	CONSTRAINT "push_subscriptions_language_check" CHECK ("push_subscriptions"."language" in ('en', 'pt-BR', 'fr'))
);
--> statement-breakpoint
ALTER TABLE "push_marks" ADD CONSTRAINT "push_marks_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_workspace_user_id_workspace_users_id_fk" FOREIGN KEY ("workspace_user_id") REFERENCES "public"."workspace_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "push_subscriptions_user_idx" ON "push_subscriptions" USING btree ("workspace_id","workspace_user_id");