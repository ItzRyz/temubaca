ALTER TABLE "communities" ADD COLUMN "bannerPath" text;--> statement-breakpoint
ALTER TABLE "communities" ADD COLUMN "instagramFollowers" integer;--> statement-breakpoint
ALTER TABLE "communities" ADD COLUMN "instagramCheckedAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "imagePath" text;