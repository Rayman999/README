ALTER TABLE "oauth_clients" ALTER COLUMN "secret_hash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "oauth_clients" ADD COLUMN "client_type" text DEFAULT 'confidential' NOT NULL;