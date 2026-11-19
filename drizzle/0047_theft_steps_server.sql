ALTER TABLE "theft_follow_ups" DROP CONSTRAINT "theft_follow_ups_state_check";--> statement-breakpoint
ALTER TABLE "thefts" ADD COLUMN "attacker_server" integer;--> statement-breakpoint
ALTER TABLE "thefts" ADD COLUMN "items" text;--> statement-breakpoint
ALTER TABLE "theft_follow_ups" ADD CONSTRAINT "theft_follow_ups_state_check" CHECK ("theft_follow_ups"."state" in ('open', 'warned', 'talked', 'retaliated', 'resolved'));