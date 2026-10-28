-- TB-023 (28 Okt 2026): libraries and book_accesses become real app data. Their synthetic seed rows (id prefix
-- 5eed0001-, owned by scripts/seed) are removed first; no app table pointed at them.
DELETE FROM "book_accesses" WHERE "id"::text ~ '^5eed0001-';--> statement-breakpoint
DELETE FROM "libraries" WHERE "id"::text ~ '^5eed0001-';--> statement-breakpoint
CREATE TABLE "library_holdings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"libraryId" uuid NOT NULL,
	"bookId" uuid NOT NULL,
	"source" text NOT NULL,
	"sourceRecordId" text DEFAULT '' NOT NULL,
	"sourceUrl" text,
	"callNumber" text,
	"status" text DEFAULT 'LISTED' NOT NULL,
	"copiesTotal" integer,
	"copiesAvailable" integer,
	"checkedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedById" uuid,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "source_enum_check" CHECK ("library_holdings"."source" in ('CURATED', 'MANAGER', 'ONESEARCH')),
	CONSTRAINT "status_enum_check" CHECK ("library_holdings"."status" in ('LISTED', 'AVAILABLE', 'ON_LOAN', 'UNKNOWN')),
	CONSTRAINT "library_holdings_copies_check" CHECK ("library_holdings"."copiesTotal" >= 0 and "library_holdings"."copiesAvailable" >= 0 and "library_holdings"."copiesAvailable" <= "library_holdings"."copiesTotal")
);
--> statement-breakpoint
ALTER TABLE "library_holdings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "library_managers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"libraryId" uuid NOT NULL,
	"userId" uuid NOT NULL,
	"createdById" uuid,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "library_managers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "book_accesses" DROP CONSTRAINT "book_accesses_requestId_unique";--> statement-breakpoint
ALTER TABLE "admin_audit_logs" DROP CONSTRAINT "action_enum_check";--> statement-breakpoint
ALTER TABLE "admin_audit_logs" DROP CONSTRAINT "targetType_enum_check";--> statement-breakpoint
ALTER TABLE "book_accesses" DROP CONSTRAINT "status_enum_check";--> statement-breakpoint
ALTER TABLE "recommendations" DROP CONSTRAINT "targetType_enum_check";--> statement-breakpoint
ALTER TABLE "reports" DROP CONSTRAINT "targetType_enum_check";--> statement-breakpoint
ALTER TABLE "verifications" DROP CONSTRAINT "targetType_enum_check";--> statement-breakpoint
ALTER TABLE "book_accesses" DROP CONSTRAINT "book_accesses_requestId_borrow_requests_id_fk";
--> statement-breakpoint
DROP INDEX "book_accesses_status_expires_at_idx";--> statement-breakpoint
DROP INDEX "book_accesses_granted_at_idx";--> statement-breakpoint
ALTER TABLE "libraries" ADD COLUMN "placeId" uuid;--> statement-breakpoint
ALTER TABLE "libraries" ADD COLUMN "regionCode" text;--> statement-breakpoint
ALTER TABLE "libraries" ADD COLUMN "catalogUrl" text;--> statement-breakpoint
ALTER TABLE "libraries" ADD COLUMN "oneSearchInstitution" text;--> statement-breakpoint
ALTER TABLE "libraries" ADD COLUMN "accessEnabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "libraries" ADD COLUMN "accessRules" text;--> statement-breakpoint
ALTER TABLE "libraries" ADD COLUMN "pickupDays" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "libraries" ADD COLUMN "hiddenAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "library_holdings" ADD CONSTRAINT "library_holdings_libraryId_libraries_id_fk" FOREIGN KEY ("libraryId") REFERENCES "public"."libraries"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "library_holdings" ADD CONSTRAINT "library_holdings_bookId_books_id_fk" FOREIGN KEY ("bookId") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "library_holdings" ADD CONSTRAINT "library_holdings_updatedById_user_profiles_id_fk" FOREIGN KEY ("updatedById") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "library_managers" ADD CONSTRAINT "library_managers_libraryId_libraries_id_fk" FOREIGN KEY ("libraryId") REFERENCES "public"."libraries"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "library_managers" ADD CONSTRAINT "library_managers_userId_user_profiles_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "library_managers" ADD CONSTRAINT "library_managers_createdById_user_profiles_id_fk" FOREIGN KEY ("createdById") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "library_holdings_source_idx" ON "library_holdings" USING btree ("libraryId","bookId","source","sourceRecordId");--> statement-breakpoint
CREATE INDEX "library_holdings_book_idx" ON "library_holdings" USING btree ("bookId");--> statement-breakpoint
CREATE UNIQUE INDEX "library_managers_library_user_idx" ON "library_managers" USING btree ("libraryId","userId");--> statement-breakpoint
CREATE INDEX "library_managers_user_idx" ON "library_managers" USING btree ("userId");--> statement-breakpoint
ALTER TABLE "libraries" ADD CONSTRAINT "libraries_placeId_places_id_fk" FOREIGN KEY ("placeId") REFERENCES "public"."places"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "book_accesses" DROP COLUMN "requestId";--> statement-breakpoint
ALTER TABLE "book_accesses" DROP COLUMN "grantedAt";--> statement-breakpoint
ALTER TABLE "book_accesses" DROP COLUMN "revokedAt";--> statement-breakpoint
ALTER TABLE "book_accesses" DROP COLUMN "note";--> statement-breakpoint
ALTER TABLE "libraries" ADD CONSTRAINT "libraries_placeId_unique" UNIQUE("placeId");--> statement-breakpoint
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "action_enum_check" CHECK ("admin_audit_logs"."action" in ('USER_SUSPENDED', 'USER_REINSTATED', 'USER_ROLE_CHANGED', 'USER_EMAIL_REVEALED', 'SETTINGS_UPDATED', 'BORROWING_DISPUTE_RESOLVED', 'ACCOUNT_DELETED', 'RETENTION_RUN', 'PLACE_CREATED', 'PLACE_UPDATED', 'PLACE_HIDDEN', 'PLACE_RESTORED', 'LIBRARY_CREATED', 'LIBRARY_UPDATED', 'LIBRARY_MANAGER_ADDED', 'LIBRARY_MANAGER_REMOVED', 'LIBRARY_HOLDING_CHANGED'));--> statement-breakpoint
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "targetType_enum_check" CHECK ("admin_audit_logs"."targetType" in ('BOOK', 'BOOK_LISTING', 'COMMUNITY', 'EVENT', 'MERCHANDISE_LISTING', 'USER', 'BORROW_REQUEST', 'BORROWING', 'ORDER', 'PLACE', 'LIBRARY', 'OTHER'));--> statement-breakpoint
ALTER TABLE "libraries" ADD CONSTRAINT "libraries_region_code_check" CHECK ("libraries"."regionCode" ~ '^[0-9]{2}[.][0-9]{2}$');--> statement-breakpoint
ALTER TABLE "libraries" ADD CONSTRAINT "libraries_pickup_days_check" CHECK ("libraries"."pickupDays" between 1 and 14);--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "targetType_enum_check" CHECK ("recommendations"."targetType" in ('BOOK', 'BOOK_LISTING', 'COMMUNITY', 'EVENT', 'MERCHANDISE_LISTING', 'USER', 'BORROW_REQUEST', 'BORROWING', 'ORDER', 'PLACE', 'LIBRARY', 'OTHER'));--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "targetType_enum_check" CHECK ("reports"."targetType" in ('BOOK', 'BOOK_LISTING', 'COMMUNITY', 'EVENT', 'MERCHANDISE_LISTING', 'USER', 'BORROW_REQUEST', 'BORROWING', 'ORDER', 'PLACE', 'LIBRARY', 'OTHER'));--> statement-breakpoint
ALTER TABLE "verifications" ADD CONSTRAINT "targetType_enum_check" CHECK ("verifications"."targetType" in ('BOOK', 'BOOK_LISTING', 'COMMUNITY', 'EVENT', 'MERCHANDISE_LISTING', 'USER', 'BORROW_REQUEST', 'BORROWING', 'ORDER', 'PLACE', 'LIBRARY', 'OTHER'));--> statement-breakpoint
CREATE POLICY temubaca_app_all ON public.library_holdings TO temubaca_app USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY temubaca_app_all ON public.library_managers TO temubaca_app USING (true) WITH CHECK (true);