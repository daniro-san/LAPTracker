CREATE TABLE "kvk_claims" (
	"workspace_id" integer NOT NULL,
	"entry_id" integer NOT NULL,
	"role" text NOT NULL,
	"uid" bigint NOT NULL,
	"asked_at" timestamp with time zone NOT NULL,
	CONSTRAINT "kvk_claims_entry_id_role_uid_pk" PRIMARY KEY("entry_id","role","uid")
);
--> statement-breakpoint
ALTER TABLE "workspace_post_touches" DROP CONSTRAINT "workspace_post_touches_post_key_check";--> statement-breakpoint
ALTER TABLE "workspace_posts" DROP CONSTRAINT "workspace_posts_post_key_check";--> statement-breakpoint
ALTER TABLE "kvk_claims" ADD CONSTRAINT "kvk_claims_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kvk_claims" ADD CONSTRAINT "kvk_claims_entry_id_calendar_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."calendar_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "kvk_claims_workspace_idx" ON "kvk_claims" USING btree ("workspace_id");--> statement-breakpoint
ALTER TABLE "workspace_post_touches" ADD CONSTRAINT "workspace_post_touches_post_key_check" CHECK ("workspace_post_touches"."post_key" in ('shield', 'thanks', 'garrison', 'week', 'shield_up', 'welcome', 'summary', 'kvk', 'kvk_soon'));--> statement-breakpoint
ALTER TABLE "workspace_posts" ADD CONSTRAINT "workspace_posts_post_key_check" CHECK ("workspace_posts"."post_key" in ('week', 'shield_up', 'welcome', 'summary', 'kvk', 'kvk_soon'));