-- D69: a sample is a snapshots row of phase 'sample' with its slot_at. One Before and one After per
-- event stay unique (the old constraint becomes a partial index), and one sample per (event, slot_at).
ALTER TABLE "snapshots" DROP CONSTRAINT "snapshots_event_phase_unique";--> statement-breakpoint
ALTER TABLE "snapshots" DROP CONSTRAINT "snapshots_phase_check";--> statement-breakpoint
ALTER TABLE "alliance_snapshots" ADD COLUMN "member_uids" bigint[];--> statement-breakpoint
ALTER TABLE "alliance_snapshots" ADD COLUMN "member_names" text[];--> statement-breakpoint
ALTER TABLE "alliance_snapshots" ADD COLUMN "member_power" bigint[];--> statement-breakpoint
ALTER TABLE "alliance_snapshots" ADD COLUMN "member_kills" bigint[];--> statement-breakpoint
ALTER TABLE "snapshots" ADD COLUMN "slot_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "snapshots_event_phase_unique" ON "snapshots" USING btree ("event_id","phase") WHERE "snapshots"."phase" <> 'sample';--> statement-breakpoint
CREATE UNIQUE INDEX "snapshots_event_slot_unique" ON "snapshots" USING btree ("event_id","slot_at") WHERE "snapshots"."phase" = 'sample';--> statement-breakpoint
ALTER TABLE "snapshots" ADD CONSTRAINT "snapshots_slot_check" CHECK (("snapshots"."phase" = 'sample') = ("snapshots"."slot_at" is not null));--> statement-breakpoint
ALTER TABLE "snapshots" ADD CONSTRAINT "snapshots_phase_check" CHECK ("snapshots"."phase" in ('before', 'after', 'sample'));