CREATE TABLE "borrower_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"borrowingId" uuid NOT NULL,
	"requesterId" uuid NOT NULL,
	"reviewerId" uuid,
	"communityId" uuid,
	"rating" integer NOT NULL,
	"comment" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "borrower_reviews_borrowingId_unique" UNIQUE("borrowingId"),
	CONSTRAINT "borrower_reviews_rating_check" CHECK ("borrower_reviews"."rating" between 1 and 5),
	CONSTRAINT "borrower_reviews_comment_check" CHECK (char_length("borrower_reviews"."comment") <= 500)
);
--> statement-breakpoint
ALTER TABLE "borrower_reviews" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "borrow_requests" ADD COLUMN "preferredAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "borrower_reviews" ADD CONSTRAINT "borrower_reviews_borrowingId_borrowings_id_fk" FOREIGN KEY ("borrowingId") REFERENCES "public"."borrowings"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "borrower_reviews" ADD CONSTRAINT "borrower_reviews_requesterId_user_profiles_id_fk" FOREIGN KEY ("requesterId") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "borrower_reviews" ADD CONSTRAINT "borrower_reviews_reviewerId_user_profiles_id_fk" FOREIGN KEY ("reviewerId") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "borrower_reviews" ADD CONSTRAINT "borrower_reviews_communityId_communities_id_fk" FOREIGN KEY ("communityId") REFERENCES "public"."communities"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "borrower_reviews_requester_idx" ON "borrower_reviews" USING btree ("requesterId","createdAt");--> statement-breakpoint
CREATE POLICY temubaca_app_all ON public.borrower_reviews TO temubaca_app USING (true) WITH CHECK (true);
