ALTER TABLE "merchandise_listings" ADD COLUMN "variants" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "merchandise_listings" ADD COLUMN "fulfillmentNote" text;--> statement-breakpoint
ALTER TABLE "merchandise_listings" ADD COLUMN "photoPaths" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "merchandise_listings" ADD CONSTRAINT "merchandise_listings_photo_paths_check" CHECK (cardinality("merchandise_listings"."photoPaths") <= 3);--> statement-breakpoint
ALTER TABLE "merchandise_listings" ADD CONSTRAINT "merchandise_listings_variants_check" CHECK (cardinality("merchandise_listings"."variants") <= 10);