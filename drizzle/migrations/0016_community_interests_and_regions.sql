ALTER TABLE "communities" ADD COLUMN "interests" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "communities" ADD COLUMN "regionCode" text;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "regionCode" text;--> statement-breakpoint
ALTER TABLE "communities" ADD CONSTRAINT "communities_interests_check" CHECK (cardinality("communities"."interests") <= 5);--> statement-breakpoint
ALTER TABLE "communities" ADD CONSTRAINT "communities_region_code_check" CHECK ("communities"."regionCode" ~ '^[0-9]{2}[.][0-9]{2}$');--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_region_code_check" CHECK ("user_profiles"."regionCode" ~ '^[0-9]{2}[.][0-9]{2}$');