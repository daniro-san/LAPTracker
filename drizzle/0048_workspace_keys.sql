CREATE TABLE "workspace_key_changes" (
	"id" serial PRIMARY KEY NOT NULL,
	"workspace_id" integer NOT NULL,
	"action" text NOT NULL,
	"changed_by" integer,
	"changed_at" timestamp with time zone NOT NULL,
	"request_id" text NOT NULL,
	CONSTRAINT "workspace_key_changes_request_unique" UNIQUE("workspace_id","request_id"),
	CONSTRAINT "workspace_key_changes_action_check" CHECK ("workspace_key_changes"."action" in ('set', 'removed'))
);
--> statement-breakpoint
CREATE TABLE "workspace_keys" (
	"workspace_id" integer PRIMARY KEY NOT NULL,
	"ciphertext" text,
	"nonce" text,
	"master_fp" text,
	"last4" text,
	"status" text NOT NULL,
	"status_at" timestamp with time zone NOT NULL,
	"quota_remaining" integer,
	CONSTRAINT "workspace_keys_status_check" CHECK ("workspace_keys"."status" in ('unset', 'ok', 'invalid', 'out_of_quota', 'reenter'))
);
--> statement-breakpoint
ALTER TABLE "squad_reads" DROP CONSTRAINT "squad_reads_pkey";--> statement-breakpoint
ALTER TABLE "squad_reads" ADD CONSTRAINT "squad_reads_day_union_pk" PRIMARY KEY("day","union_id");--> statement-breakpoint
ALTER TABLE "workspace_key_changes" ADD CONSTRAINT "workspace_key_changes_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_key_changes" ADD CONSTRAINT "workspace_key_changes_changed_by_workspace_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."workspace_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_keys" ADD CONSTRAINT "workspace_keys_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;