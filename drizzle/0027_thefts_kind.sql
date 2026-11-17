ALTER TABLE "thefts" ADD COLUMN "kind" text;--> statement-breakpoint
UPDATE "thefts" SET "kind" = 'ops' WHERE "stolen" = 'quest_rewards';--> statement-breakpoint
ALTER TABLE "thefts" DROP CONSTRAINT "thefts_stolen_check";--> statement-breakpoint
ALTER TABLE "thefts" DROP COLUMN "stolen";--> statement-breakpoint
ALTER TABLE "thefts" ADD CONSTRAINT "thefts_kind_check" CHECK ("thefts"."kind" is null or "thefts"."kind" in ('tile_hit', 'ops', 'caravan', 'sanctuary'));
