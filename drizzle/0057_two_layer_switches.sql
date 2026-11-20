CREATE TABLE "feature_defaults" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"switches" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"caps" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feature_defaults_one_row" CHECK ("feature_defaults"."id" = 1)
);
--> statement-breakpoint
ALTER TABLE "workspace_features" DROP CONSTRAINT "workspace_features_caps_check";--> statement-breakpoint
ALTER TABLE "workspace_features" ADD COLUMN "caps" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "workspace_features" ADD COLUMN "alliance_switches" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
-- D134: each cap the owner set moves into the map; a null (no cap set) follows the defaults from now on.
UPDATE "workspace_features" SET "caps" = jsonb_strip_nulls(jsonb_build_object('ai', "ai_per_day", 'translate', "translate_per_day"));--> statement-breakpoint
ALTER TABLE "workspace_features" DROP COLUMN "ai_per_day";--> statement-breakpoint
ALTER TABLE "workspace_features" DROP COLUMN "translate_per_day";