ALTER TABLE "workspaces" ADD COLUMN "member_role_ids" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
DELETE FROM "workspace_sessions" WHERE "tier" = 'member';