ALTER TABLE "sections" ADD COLUMN "parent_id" uuid;--> statement-breakpoint
ALTER TABLE "sections" ADD CONSTRAINT "sections_parent_id_sections_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."sections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sections_parent_idx" ON "sections" USING btree ("parent_id");