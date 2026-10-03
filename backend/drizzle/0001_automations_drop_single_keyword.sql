DROP INDEX "automations_media_id_idx";--> statement-breakpoint
ALTER TABLE "automations" ALTER COLUMN "name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "automations" DROP COLUMN "keyword";--> statement-breakpoint
ALTER TABLE "automations" DROP COLUMN "match_type";--> statement-breakpoint
ALTER TABLE "automations" ADD CONSTRAINT "automations_media_id_unique" UNIQUE("media_id");--> statement-breakpoint
DROP TYPE "public"."keyword_match_type";