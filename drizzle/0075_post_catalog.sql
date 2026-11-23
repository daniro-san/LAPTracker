CREATE TABLE "post_runs" (
	"workspace_id" integer NOT NULL,
	"post_key" text NOT NULL,
	"period" text NOT NULL,
	"status" text NOT NULL,
	"sent" integer DEFAULT 0 NOT NULL,
	"attempts" smallint DEFAULT 1 NOT NULL,
	"at" timestamp with time zone NOT NULL,
	CONSTRAINT "post_runs_workspace_id_post_key_period_pk" PRIMARY KEY("workspace_id","post_key","period"),
	CONSTRAINT "post_runs_status_check" CHECK ("post_runs"."status" in ('posting', 'posted', 'failed', 'unanswered', 'skipped'))
);
--> statement-breakpoint
CREATE TABLE "workspace_posts" (
	"workspace_id" integer NOT NULL,
	"post_key" text NOT NULL,
	"on" boolean DEFAULT false NOT NULL,
	"channel" text NOT NULL,
	"weekday" smallint,
	"title" text DEFAULT '' NOT NULL,
	"picture" boolean DEFAULT false NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"updated_by" integer,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "workspace_posts_workspace_id_post_key_pk" PRIMARY KEY("workspace_id","post_key"),
	CONSTRAINT "workspace_posts_post_key_check" CHECK ("workspace_posts"."post_key" in ('week')),
	CONSTRAINT "workspace_posts_channel_check" CHECK ("workspace_posts"."channel" in ('members', 'leaders')),
	CONSTRAINT "workspace_posts_weekday_check" CHECK ("workspace_posts"."weekday" between 0 and 6),
	CONSTRAINT "workspace_posts_language_check" CHECK ("workspace_posts"."language" in ('en', 'pt-BR', 'fr'))
);
--> statement-breakpoint
ALTER TABLE "workspace_post_touches" DROP CONSTRAINT "workspace_post_touches_post_key_check";--> statement-breakpoint
ALTER TABLE "post_runs" ADD CONSTRAINT "post_runs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_posts" ADD CONSTRAINT "workspace_posts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_posts" ADD CONSTRAINT "workspace_posts_updated_by_workspace_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."workspace_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_post_touches" ADD CONSTRAINT "workspace_post_touches_post_key_check" CHECK ("workspace_post_touches"."post_key" in ('shield', 'thanks', 'garrison', 'week'));