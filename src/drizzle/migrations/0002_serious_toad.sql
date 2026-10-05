ALTER TABLE "user_profiles" ALTER COLUMN "updatedAt" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "role" text DEFAULT 'MEMBER' NOT NULL;