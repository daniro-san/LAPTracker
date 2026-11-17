CREATE TABLE "discord_pictures" (
	"workspace_id" integer NOT NULL,
	"message_id" text NOT NULL,
	"attachment_id" text NOT NULL,
	"draft_id" integer,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "discord_pictures_workspace_id_message_id_attachment_id_pk" PRIMARY KEY("workspace_id","message_id","attachment_id")
);
--> statement-breakpoint
ALTER TABLE "workspace_sessions" ADD COLUMN "checked_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar_entries" ADD COLUMN "request_id" text;--> statement-breakpoint
ALTER TABLE "notices" ADD COLUMN "request_id" text;--> statement-breakpoint
ALTER TABLE "thefts" ADD COLUMN "request_id" text;--> statement-breakpoint
ALTER TABLE "discord_pictures" ADD CONSTRAINT "discord_pictures_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discord_pictures" ADD CONSTRAINT "discord_pictures_draft_id_screenshot_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."screenshot_drafts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_entries_request_unique" ON "calendar_entries" USING btree ("workspace_id","request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notices_request_unique" ON "notices" USING btree ("workspace_id","request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "thefts_request_unique" ON "thefts" USING btree ("workspace_id","request_id");