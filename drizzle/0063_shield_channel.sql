ALTER TABLE "workspace_webhooks" DROP CONSTRAINT "workspace_webhooks_channel_check";--> statement-breakpoint
ALTER TABLE "shield_checks" ADD COLUMN "message_hook" text;--> statement-breakpoint
ALTER TABLE "workspace_webhooks" ADD CONSTRAINT "workspace_webhooks_channel_check" CHECK ("workspace_webhooks"."channel" in ('leaders', 'members', 'shield'));