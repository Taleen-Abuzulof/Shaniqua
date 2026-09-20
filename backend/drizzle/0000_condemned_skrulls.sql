CREATE TYPE "public"."automation_status" AS ENUM('active', 'paused');--> statement-breakpoint
CREATE TYPE "public"."delivery_status" AS ENUM('sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."ig_account_status" AS ENUM('active', 'token_expired', 'disconnected');--> statement-breakpoint
CREATE TYPE "public"."keyword_match_type" AS ENUM('contains', 'exact');--> statement-breakpoint
CREATE TYPE "public"."media_product_type" AS ENUM('FEED', 'REELS', 'STORY', 'AD');--> statement-breakpoint
CREATE TYPE "public"."media_type" AS ENUM('IMAGE', 'VIDEO', 'CAROUSEL_ALBUM');--> statement-breakpoint
-- "auth"."users" already exists (managed by Supabase Auth) — not created here.
CREATE TABLE "automation_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"automation_id" uuid NOT NULL,
	"ig_comment_id" text NOT NULL,
	"commenter_ig_id" text,
	"status" "delivery_status" NOT NULL,
	"latency_ms" integer NOT NULL,
	"ig_message_id" text,
	"error_code" text,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "automation_logs_automation_comment_uniq" UNIQUE("automation_id","ig_comment_id")
);
--> statement-breakpoint
CREATE TABLE "automations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ig_account_id" uuid NOT NULL,
	"media_id" uuid NOT NULL,
	"name" text NOT NULL,
	"keyword" text NOT NULL,
	"match_type" "keyword_match_type" DEFAULT 'contains' NOT NULL,
	"message_template" text NOT NULL,
	"status" "automation_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ig_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"ig_user_id" text NOT NULL,
	"username" text NOT NULL,
	"name" text,
	"profile_picture_url" text,
	"access_token_encrypted" text NOT NULL,
	"token_expires_at" timestamp with time zone,
	"scopes" text[] DEFAULT '{}'::text[] NOT NULL,
	"status" "ig_account_status" DEFAULT 'active' NOT NULL,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ig_accounts_ig_user_id_unique" UNIQUE("ig_user_id")
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ig_account_id" uuid NOT NULL,
	"ig_media_id" text NOT NULL,
	"media_type" "media_type" NOT NULL,
	"media_product_type" "media_product_type" NOT NULL,
	"caption" text,
	"permalink" text NOT NULL,
	"media_url" text,
	"thumbnail_url" text,
	"posted_at" timestamp with time zone NOT NULL,
	"like_count" integer,
	"comments_count" integer,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_ig_media_id_unique" UNIQUE("ig_media_id")
);
--> statement-breakpoint
ALTER TABLE "automation_logs" ADD CONSTRAINT "automation_logs_automation_id_automations_id_fk" FOREIGN KEY ("automation_id") REFERENCES "public"."automations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automations" ADD CONSTRAINT "automations_ig_account_id_ig_accounts_id_fk" FOREIGN KEY ("ig_account_id") REFERENCES "public"."ig_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automations" ADD CONSTRAINT "automations_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ig_accounts" ADD CONSTRAINT "ig_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_ig_account_id_ig_accounts_id_fk" FOREIGN KEY ("ig_account_id") REFERENCES "public"."ig_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "automation_logs_automation_created_idx" ON "automation_logs" USING btree ("automation_id","created_at");--> statement-breakpoint
CREATE INDEX "automations_ig_account_id_idx" ON "automations" USING btree ("ig_account_id");--> statement-breakpoint
CREATE INDEX "automations_media_id_idx" ON "automations" USING btree ("media_id");--> statement-breakpoint
CREATE INDEX "ig_accounts_user_id_idx" ON "ig_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "media_ig_account_posted_at_idx" ON "media" USING btree ("ig_account_id","posted_at");