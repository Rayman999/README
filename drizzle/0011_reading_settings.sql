CREATE TABLE "reading_days" (
	"user_id" uuid NOT NULL,
	"day" date NOT NULL,
	"seconds" integer DEFAULT 0 NOT NULL,
	"pages_finished" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "reading_days_user_id_day_pk" PRIMARY KEY("user_id","day")
);
--> statement-breakpoint
ALTER TABLE "reader_profiles" ADD COLUMN "project_presets" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "reading_days" ADD CONSTRAINT "reading_days_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;