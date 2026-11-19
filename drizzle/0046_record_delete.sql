DROP INDEX "calendar_entries_duel_week_unique";--> statement-breakpoint
ALTER TABLE "pending_members" ADD COLUMN "deleted_by" integer;--> statement-breakpoint
ALTER TABLE "pending_members" ADD COLUMN "delete_request_id" text;--> statement-breakpoint
ALTER TABLE "calendar_entries" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "calendar_entries" ADD COLUMN "deleted_by" integer;--> statement-breakpoint
ALTER TABLE "calendar_entries" ADD COLUMN "delete_request_id" text;--> statement-breakpoint
ALTER TABLE "thefts" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "thefts" ADD COLUMN "deleted_by" integer;--> statement-breakpoint
ALTER TABLE "thefts" ADD COLUMN "delete_request_id" text;--> statement-breakpoint
ALTER TABLE "pending_members" ADD CONSTRAINT "pending_members_deleted_by_workspace_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."workspace_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_entries" ADD CONSTRAINT "calendar_entries_deleted_by_workspace_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."workspace_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thefts" ADD CONSTRAINT "thefts_deleted_by_workspace_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."workspace_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_entries_duel_week_unique" ON "calendar_entries" USING btree ("workspace_id","day") WHERE "calendar_entries"."kind" = 'duel' and "calendar_entries"."deleted_at" is null;