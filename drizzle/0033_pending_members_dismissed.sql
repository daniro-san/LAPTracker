DROP INDEX "pending_members_open_key_unique";--> statement-breakpoint
ALTER TABLE "pending_members" ADD COLUMN "dismissed_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "pending_members_open_key_unique" ON "pending_members" USING btree ("workspace_id","name_key") WHERE "pending_members"."matched_uid" is null and "pending_members"."dismissed_at" is null;