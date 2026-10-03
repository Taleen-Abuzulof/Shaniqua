ALTER TABLE "automations" ADD COLUMN "keywords" text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "automations" ADD COLUMN "button_text" text NOT NULL;--> statement-breakpoint
ALTER TABLE "automations" ADD COLUMN "urls" text[] NOT NULL;