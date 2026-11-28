ALTER TABLE "shield_settings" ADD COLUMN "night_minute" integer DEFAULT 1410 NOT NULL;--> statement-breakpoint
ALTER TABLE "shield_settings" ADD COLUMN "reset_read" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "shield_settings" ADD COLUMN "reset_minute" integer DEFAULT 150 NOT NULL;--> statement-breakpoint
ALTER TABLE "shield_settings" ADD CONSTRAINT "shield_settings_night_check" CHECK ("shield_settings"."night_minute" between 1200 and 1425);--> statement-breakpoint
ALTER TABLE "shield_settings" ADD CONSTRAINT "shield_settings_reset_check" CHECK ("shield_settings"."reset_minute" between 15 and 615);