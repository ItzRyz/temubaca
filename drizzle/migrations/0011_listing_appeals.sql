CREATE TABLE "listing_appeals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listingId" uuid NOT NULL,
	"ownerId" uuid,
	"reason" text NOT NULL,
	"details" text NOT NULL,
	"filePath" text,
	"fileName" text,
	"fileType" text,
	"fileSize" integer,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"reviewerId" uuid,
	"reviewNote" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewedAt" timestamp with time zone,
	CONSTRAINT "status_enum_check" CHECK ("listing_appeals"."status" in ('PENDING', 'APPROVED', 'REJECTED', 'REVOKED'))
);
--> statement-breakpoint
ALTER TABLE "listing_appeals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "listing_appeals" ADD CONSTRAINT "listing_appeals_listingId_book_listings_id_fk" FOREIGN KEY ("listingId") REFERENCES "public"."book_listings"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "listing_appeals" ADD CONSTRAINT "listing_appeals_ownerId_user_profiles_id_fk" FOREIGN KEY ("ownerId") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "listing_appeals" ADD CONSTRAINT "listing_appeals_reviewerId_user_profiles_id_fk" FOREIGN KEY ("reviewerId") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "listing_appeals_listing_idx" ON "listing_appeals" USING btree ("listingId","createdAt");--> statement-breakpoint
CREATE INDEX "listing_appeals_status_idx" ON "listing_appeals" USING btree ("status","createdAt");--> statement-breakpoint
CREATE UNIQUE INDEX "listing_appeals_one_open_idx" ON "listing_appeals" USING btree ("listingId") WHERE "listing_appeals"."status" = 'PENDING';