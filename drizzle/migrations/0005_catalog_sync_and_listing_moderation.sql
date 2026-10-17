CREATE TABLE "book_sync_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bookId" uuid NOT NULL,
	"provider" text NOT NULL,
	"status" text NOT NULL,
	"trigger" text NOT NULL,
	"changedFields" text[] DEFAULT '{}'::text[] NOT NULL,
	"message" text,
	"actorId" uuid,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "provider_enum_check" CHECK ("book_sync_logs"."provider" in ('GOOGLE_BOOKS', 'OPEN_LIBRARY', 'MANUAL', 'OTHER')),
	CONSTRAINT "status_enum_check" CHECK ("book_sync_logs"."status" in ('SUCCESS', 'FAILED')),
	CONSTRAINT "trigger_enum_check" CHECK ("book_sync_logs"."trigger" in ('IMPORT', 'MANUAL'))
);
--> statement-breakpoint
ALTER TABLE "book_sync_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "book_listings" ADD COLUMN "hiddenAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "book_listings" ADD COLUMN "hiddenReason" text;--> statement-breakpoint
ALTER TABLE "book_listings" ADD COLUMN "hiddenById" uuid;--> statement-breakpoint
ALTER TABLE "books" ADD COLUMN "syncedAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "book_sync_logs" ADD CONSTRAINT "book_sync_logs_bookId_books_id_fk" FOREIGN KEY ("bookId") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "book_sync_logs" ADD CONSTRAINT "book_sync_logs_actorId_user_profiles_id_fk" FOREIGN KEY ("actorId") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "book_sync_logs_book_id_created_at_idx" ON "book_sync_logs" USING btree ("bookId","createdAt");--> statement-breakpoint
CREATE INDEX "book_sync_logs_status_created_at_idx" ON "book_sync_logs" USING btree ("status","createdAt");--> statement-breakpoint
ALTER TABLE "book_listings" ADD CONSTRAINT "book_listings_hiddenById_user_profiles_id_fk" FOREIGN KEY ("hiddenById") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE cascade;