CREATE TABLE "workspace_discord" (
	"workspace_id" integer PRIMARY KEY NOT NULL,
	"bot_seen_at" timestamp with time zone,
	"commands" jsonb,
	"commands_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "workspace_webhooks" (
	"workspace_id" integer NOT NULL,
	"channel" text NOT NULL,
	"ciphertext" text NOT NULL,
	"nonce" text NOT NULL,
	"master_fp" text NOT NULL,
	"name" text NOT NULL,
	"forum" boolean NOT NULL,
	"saved_by" integer,
	"saved_at" timestamp with time zone NOT NULL,
	"request_id" text NOT NULL,
	CONSTRAINT "workspace_webhooks_workspace_id_channel_pk" PRIMARY KEY("workspace_id","channel"),
	CONSTRAINT "workspace_webhooks_channel_check" CHECK ("workspace_webhooks"."channel" in ('leaders', 'members'))
);
--> statement-breakpoint
ALTER TABLE "workspace_discord" ADD CONSTRAINT "workspace_discord_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_webhooks" ADD CONSTRAINT "workspace_webhooks_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_webhooks" ADD CONSTRAINT "workspace_webhooks_saved_by_workspace_users_id_fk" FOREIGN KEY ("saved_by") REFERENCES "public"."workspace_users"("id") ON DELETE set null ON UPDATE no action;