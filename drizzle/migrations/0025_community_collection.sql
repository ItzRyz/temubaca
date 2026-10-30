ALTER TABLE "book_listings" ADD COLUMN "communityId" uuid;--> statement-breakpoint
ALTER TABLE "book_listings" ADD CONSTRAINT "book_listings_communityId_communities_id_fk" FOREIGN KEY ("communityId") REFERENCES "public"."communities"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "book_listings_community_id_idx" ON "book_listings" USING btree ("communityId");