CREATE TABLE "access_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"union_id" bigint NOT NULL,
	"player_name" text NOT NULL,
	"claimed_role" text NOT NULL,
	"roster_match" text NOT NULL,
	"roster_rank" text,
	"roster_seen_at" timestamp with time zone,
	"status_hash" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"decision" text,
	"decided_at" timestamp with time zone,
	"decline_reason" text,
	"invite_id" integer,
	CONSTRAINT "access_requests_role_check" CHECK ("access_requests"."claimed_role" in ('r5', 'r4')),
	CONSTRAINT "access_requests_match_check" CHECK ("access_requests"."roster_match" in ('found', 'not_found'))
);
--> statement-breakpoint
CREATE TABLE "alliance_invites" (
	"id" serial PRIMARY KEY NOT NULL,
	"union_id" bigint NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"cancelled_at" timestamp with time zone,
	"claimed_by" text,
	"claimed_name" text,
	"claim_hash" text,
	"guilds" jsonb,
	"guild_id" text,
	"used_at" timestamp with time zone,
	"created_slug" text
);
--> statement-breakpoint
ALTER TABLE "access_requests" ADD CONSTRAINT "access_requests_invite_id_alliance_invites_id_fk" FOREIGN KEY ("invite_id") REFERENCES "public"."alliance_invites"("id") ON DELETE set null ON UPDATE no action;