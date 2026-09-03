DROP INDEX "pages_project_slug_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "pages_project_slug_idx" ON "pages" USING btree ("project_id","slug") WHERE "pages"."deleted_at" is null;