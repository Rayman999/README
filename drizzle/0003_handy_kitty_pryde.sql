ALTER TABLE "page_revisions" ADD COLUMN "document" jsonb;--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN "document" jsonb;--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;