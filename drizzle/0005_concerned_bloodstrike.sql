ALTER TABLE "events" ADD COLUMN "visibility" text DEFAULT 'standalone' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "post_public" boolean DEFAULT false NOT NULL;