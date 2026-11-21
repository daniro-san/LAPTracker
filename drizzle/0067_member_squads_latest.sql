DROP INDEX "member_squads_member_idx";--> statement-breakpoint
CREATE INDEX "member_squads_latest_idx" ON "member_squads" USING btree ("union_id","uid","squad","read_at","id");