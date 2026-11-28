ALTER TABLE "workspace_usage" DROP CONSTRAINT "workspace_usage_allowance_check";--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "plan" text DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "plan_grandfathered_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_plan_check" CHECK ("workspaces"."plan" in ('free', 'premium'));--> statement-breakpoint
ALTER TABLE "workspace_usage" ADD CONSTRAINT "workspace_usage_allowance_check" CHECK ("workspace_usage"."allowance" in ('ai', 'translate', 'ocr'));--> statement-breakpoint
-- D162 (owner, 2026-11-28): every workspace made before plans keeps what it has for 3 months from this migration (GRANDFATHER_MONTHS); one made from now on starts on the free plan.
UPDATE "workspaces" SET "plan_grandfathered_until" = now() + interval '3 months';
