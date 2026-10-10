CREATE TABLE "book_accesses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requestId" uuid NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"grantedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"expiresAt" timestamp with time zone,
	"revokedAt" timestamp with time zone,
	"note" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL,
	CONSTRAINT "book_accesses_requestId_unique" UNIQUE("requestId"),
	CONSTRAINT "status_enum_check" CHECK ("book_accesses"."status" in ('ACTIVE', 'REVOKED', 'EXPIRED'))
);
--> statement-breakpoint
CREATE TABLE "book_listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ownerId" uuid NOT NULL,
	"bookId" uuid NOT NULL,
	"condition" text NOT NULL,
	"availability" text DEFAULT 'AVAILABLE' NOT NULL,
	"publicLocation" text,
	"borrowingRules" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL,
	CONSTRAINT "condition_enum_check" CHECK ("book_listings"."condition" in ('NEW', 'LIKE_NEW', 'GOOD', 'FAIR', 'POOR')),
	CONSTRAINT "availability_enum_check" CHECK ("book_listings"."availability" in ('AVAILABLE', 'UNAVAILABLE', 'RESERVED'))
);
--> statement-breakpoint
CREATE TABLE "bookmarks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"bookId" uuid NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookmarks_user_id_book_id_key" UNIQUE("userId","bookId")
);
--> statement-breakpoint
CREATE TABLE "books" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text DEFAULT 'OTHER' NOT NULL,
	"providerId" text NOT NULL,
	"isbn" text,
	"title" text NOT NULL,
	"authors" text[] DEFAULT '{}'::text[] NOT NULL,
	"description" text,
	"publisher" text,
	"publishedAt" text,
	"language" text,
	"categories" text[] DEFAULT '{}'::text[] NOT NULL,
	"coverUrl" text,
	"metadata" jsonb,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL,
	CONSTRAINT "books_provider_provider_id_key" UNIQUE("provider","providerId"),
	CONSTRAINT "provider_enum_check" CHECK ("books"."provider" in ('GOOGLE_BOOKS', 'OPEN_LIBRARY', 'MANUAL', 'OTHER'))
);
--> statement-breakpoint
CREATE TABLE "borrow_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listingId" uuid NOT NULL,
	"requesterId" uuid NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"note" text,
	"requestedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL,
	"respondedAt" timestamp with time zone,
	CONSTRAINT "status_enum_check" CHECK ("borrow_requests"."status" in ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'COMPLETED'))
);
--> statement-breakpoint
CREATE TABLE "borrowings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requestId" uuid NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"handedOverAt" timestamp with time zone,
	"dueAt" timestamp with time zone,
	"returnedAt" timestamp with time zone,
	"handoverProof" jsonb,
	"returnProof" jsonb,
	"note" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL,
	CONSTRAINT "borrowings_requestId_unique" UNIQUE("requestId"),
	CONSTRAINT "status_enum_check" CHECK ("borrowings"."status" in ('ACTIVE', 'OVERDUE', 'RETURNED', 'LOST', 'CANCELLED'))
);
--> statement-breakpoint
CREATE TABLE "communities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ownerId" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"publicLocation" text,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL,
	CONSTRAINT "status_enum_check" CHECK ("communities"."status" in ('PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED'))
);
--> statement-breakpoint
CREATE TABLE "community_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"communityId" uuid NOT NULL,
	"role" text DEFAULT 'MEMBER' NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL,
	CONSTRAINT "community_memberships_user_id_community_id_key" UNIQUE("userId","communityId"),
	CONSTRAINT "role_enum_check" CHECK ("community_memberships"."role" in ('OWNER', 'MANAGER', 'MEMBER')),
	CONSTRAINT "status_enum_check" CHECK ("community_memberships"."status" in ('PENDING', 'ACTIVE', 'REJECTED', 'LEFT', 'REMOVED'))
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"communityId" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"startsAt" timestamp with time zone,
	"endsAt" timestamp with time zone,
	"publicLocation" text,
	"eventUrl" text,
	"publicationStatus" text DEFAULT 'DRAFT' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL,
	CONSTRAINT "publicationStatus_enum_check" CHECK ("events"."publicationStatus" in ('DRAFT', 'PUBLISHED', 'ARCHIVED'))
);
--> statement-breakpoint
CREATE TABLE "libraries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"publicLocation" text,
	"source" text,
	"openingHours" jsonb,
	"websiteUrl" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "merchandise_listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"communityId" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"priceAmount" numeric(12, 2),
	"currency" varchar(3),
	"priceNote" text,
	"availability" text DEFAULT 'AVAILABLE' NOT NULL,
	"imageReference" text,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL,
	CONSTRAINT "availability_enum_check" CHECK ("merchandise_listings"."availability" in ('AVAILABLE', 'UNAVAILABLE', 'RESERVED')),
	CONSTRAINT "status_enum_check" CHECK ("merchandise_listings"."status" in ('DRAFT', 'PUBLISHED', 'UNAVAILABLE', 'ARCHIVED'))
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"orderId" uuid NOT NULL,
	"merchandiseListingId" uuid NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unitPrice" numeric(12, 2),
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_items_order_id_merchandise_listing_id_key" UNIQUE("orderId","merchandiseListingId")
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"currency" varchar(3),
	"totalAmount" numeric(12, 2),
	"note" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL,
	CONSTRAINT "status_enum_check" CHECK ("orders"."status" in ('PENDING', 'CONFIRMED', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'REFUNDED'))
);
--> statement-breakpoint
CREATE TABLE "recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"targetType" text NOT NULL,
	"targetId" uuid NOT NULL,
	"score" double precision,
	"reason" text,
	"modelVersion" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "targetType_enum_check" CHECK ("recommendations"."targetType" in ('BOOK', 'BOOK_LISTING', 'COMMUNITY', 'EVENT', 'MERCHANDISE_LISTING', 'USER', 'BORROW_REQUEST', 'BORROWING', 'ORDER', 'OTHER'))
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporterId" uuid NOT NULL,
	"targetType" text NOT NULL,
	"targetId" uuid NOT NULL,
	"reason" text NOT NULL,
	"details" text,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"reviewerId" uuid,
	"outcome" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewedAt" timestamp with time zone,
	"updatedAt" timestamp with time zone NOT NULL,
	CONSTRAINT "targetType_enum_check" CHECK ("reports"."targetType" in ('BOOK', 'BOOK_LISTING', 'COMMUNITY', 'EVENT', 'MERCHANDISE_LISTING', 'USER', 'BORROW_REQUEST', 'BORROWING', 'ORDER', 'OTHER')),
	CONSTRAINT "status_enum_check" CHECK ("reports"."status" in ('PENDING', 'REVIEWING', 'RESOLVED', 'REJECTED'))
);
--> statement-breakpoint
CREATE TABLE "user_interests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"subject" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_interests_user_id_subject_key" UNIQUE("userId","subject")
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"displayName" text NOT NULL,
	"preferences" jsonb,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"targetType" text NOT NULL,
	"targetId" uuid NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"reviewerId" uuid,
	"note" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewedAt" timestamp with time zone,
	"updatedAt" timestamp with time zone NOT NULL,
	CONSTRAINT "targetType_enum_check" CHECK ("verifications"."targetType" in ('BOOK', 'BOOK_LISTING', 'COMMUNITY', 'EVENT', 'MERCHANDISE_LISTING', 'USER', 'BORROW_REQUEST', 'BORROWING', 'ORDER', 'OTHER')),
	CONSTRAINT "status_enum_check" CHECK ("verifications"."status" in ('PENDING', 'APPROVED', 'REJECTED', 'REVOKED'))
);
--> statement-breakpoint
ALTER TABLE "book_accesses" ADD CONSTRAINT "book_accesses_requestId_borrow_requests_id_fk" FOREIGN KEY ("requestId") REFERENCES "public"."borrow_requests"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "book_listings" ADD CONSTRAINT "book_listings_ownerId_user_profiles_id_fk" FOREIGN KEY ("ownerId") REFERENCES "public"."user_profiles"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "book_listings" ADD CONSTRAINT "book_listings_bookId_books_id_fk" FOREIGN KEY ("bookId") REFERENCES "public"."books"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_userId_user_profiles_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_bookId_books_id_fk" FOREIGN KEY ("bookId") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "borrow_requests" ADD CONSTRAINT "borrow_requests_listingId_book_listings_id_fk" FOREIGN KEY ("listingId") REFERENCES "public"."book_listings"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "borrow_requests" ADD CONSTRAINT "borrow_requests_requesterId_user_profiles_id_fk" FOREIGN KEY ("requesterId") REFERENCES "public"."user_profiles"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "borrowings" ADD CONSTRAINT "borrowings_requestId_borrow_requests_id_fk" FOREIGN KEY ("requestId") REFERENCES "public"."borrow_requests"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "communities" ADD CONSTRAINT "communities_ownerId_user_profiles_id_fk" FOREIGN KEY ("ownerId") REFERENCES "public"."user_profiles"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "community_memberships" ADD CONSTRAINT "community_memberships_userId_user_profiles_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "community_memberships" ADD CONSTRAINT "community_memberships_communityId_communities_id_fk" FOREIGN KEY ("communityId") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_communityId_communities_id_fk" FOREIGN KEY ("communityId") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "merchandise_listings" ADD CONSTRAINT "merchandise_listings_communityId_communities_id_fk" FOREIGN KEY ("communityId") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_orderId_orders_id_fk" FOREIGN KEY ("orderId") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_merchandiseListingId_merchandise_listings_id_fk" FOREIGN KEY ("merchandiseListingId") REFERENCES "public"."merchandise_listings"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_userId_user_profiles_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporterId_user_profiles_id_fk" FOREIGN KEY ("reporterId") REFERENCES "public"."user_profiles"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reviewerId_user_profiles_id_fk" FOREIGN KEY ("reviewerId") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "user_interests" ADD CONSTRAINT "user_interests_userId_user_profiles_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "verifications" ADD CONSTRAINT "verifications_reviewerId_user_profiles_id_fk" FOREIGN KEY ("reviewerId") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "book_accesses_status_expires_at_idx" ON "book_accesses" USING btree ("status","expiresAt");--> statement-breakpoint
CREATE INDEX "book_accesses_granted_at_idx" ON "book_accesses" USING btree ("grantedAt");--> statement-breakpoint
CREATE INDEX "book_listings_owner_id_idx" ON "book_listings" USING btree ("ownerId");--> statement-breakpoint
CREATE INDEX "book_listings_book_id_idx" ON "book_listings" USING btree ("bookId");--> statement-breakpoint
CREATE INDEX "book_listings_availability_idx" ON "book_listings" USING btree ("availability");--> statement-breakpoint
CREATE INDEX "bookmarks_book_id_idx" ON "bookmarks" USING btree ("bookId");--> statement-breakpoint
CREATE INDEX "books_title_idx" ON "books" USING btree ("title");--> statement-breakpoint
CREATE INDEX "books_isbn_idx" ON "books" USING btree ("isbn");--> statement-breakpoint
CREATE INDEX "borrow_requests_listing_id_status_idx" ON "borrow_requests" USING btree ("listingId","status");--> statement-breakpoint
CREATE INDEX "borrow_requests_requester_id_status_idx" ON "borrow_requests" USING btree ("requesterId","status");--> statement-breakpoint
CREATE INDEX "borrowings_status_due_at_idx" ON "borrowings" USING btree ("status","dueAt");--> statement-breakpoint
CREATE INDEX "communities_owner_id_idx" ON "communities" USING btree ("ownerId");--> statement-breakpoint
CREATE INDEX "communities_status_idx" ON "communities" USING btree ("status");--> statement-breakpoint
CREATE INDEX "communities_name_idx" ON "communities" USING btree ("name");--> statement-breakpoint
CREATE INDEX "community_memberships_community_role_status_idx" ON "community_memberships" USING btree ("communityId","role","status");--> statement-breakpoint
CREATE INDEX "events_community_publication_status_idx" ON "events" USING btree ("communityId","publicationStatus");--> statement-breakpoint
CREATE INDEX "events_starts_at_idx" ON "events" USING btree ("startsAt");--> statement-breakpoint
CREATE INDEX "libraries_name_idx" ON "libraries" USING btree ("name");--> statement-breakpoint
CREATE INDEX "merchandise_listings_community_status_idx" ON "merchandise_listings" USING btree ("communityId","status");--> statement-breakpoint
CREATE INDEX "merchandise_listings_availability_idx" ON "merchandise_listings" USING btree ("availability");--> statement-breakpoint
CREATE INDEX "order_items_merchandise_listing_id_idx" ON "order_items" USING btree ("merchandiseListingId");--> statement-breakpoint
CREATE INDEX "orders_status_created_at_idx" ON "orders" USING btree ("status","createdAt");--> statement-breakpoint
CREATE INDEX "recommendations_user_id_created_at_idx" ON "recommendations" USING btree ("userId","createdAt");--> statement-breakpoint
CREATE INDEX "recommendations_target_type_target_id_idx" ON "recommendations" USING btree ("targetType","targetId");--> statement-breakpoint
CREATE INDEX "reports_reporter_id_created_at_idx" ON "reports" USING btree ("reporterId","createdAt");--> statement-breakpoint
CREATE INDEX "reports_target_type_target_id_idx" ON "reports" USING btree ("targetType","targetId");--> statement-breakpoint
CREATE INDEX "reports_status_created_at_idx" ON "reports" USING btree ("status","createdAt");--> statement-breakpoint
CREATE INDEX "user_interests_subject_idx" ON "user_interests" USING btree ("subject");--> statement-breakpoint
CREATE INDEX "verifications_target_type_target_id_idx" ON "verifications" USING btree ("targetType","targetId");--> statement-breakpoint
CREATE INDEX "verifications_status_created_at_idx" ON "verifications" USING btree ("status","createdAt");