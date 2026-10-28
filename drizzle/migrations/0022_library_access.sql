ALTER TABLE "book_accesses" ALTER COLUMN "status" SET DEFAULT 'PENDING';--> statement-breakpoint
ALTER TABLE "book_accesses" ADD COLUMN "libraryId" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "book_accesses" ADD COLUMN "bookId" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "book_accesses" ADD COLUMN "requesterId" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "book_accesses" ADD COLUMN "message" text;--> statement-breakpoint
ALTER TABLE "book_accesses" ADD COLUMN "responseNote" text;--> statement-breakpoint
ALTER TABLE "book_accesses" ADD COLUMN "respondedById" uuid;--> statement-breakpoint
ALTER TABLE "book_accesses" ADD COLUMN "respondedAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "book_accesses" ADD COLUMN "collectedAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "books" ADD COLUMN "librariesCheckedAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "book_accesses" ADD CONSTRAINT "book_accesses_libraryId_libraries_id_fk" FOREIGN KEY ("libraryId") REFERENCES "public"."libraries"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "book_accesses" ADD CONSTRAINT "book_accesses_bookId_books_id_fk" FOREIGN KEY ("bookId") REFERENCES "public"."books"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "book_accesses" ADD CONSTRAINT "book_accesses_requesterId_user_profiles_id_fk" FOREIGN KEY ("requesterId") REFERENCES "public"."user_profiles"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "book_accesses" ADD CONSTRAINT "book_accesses_respondedById_user_profiles_id_fk" FOREIGN KEY ("respondedById") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "book_accesses_library_status_idx" ON "book_accesses" USING btree ("libraryId","status");--> statement-breakpoint
CREATE INDEX "book_accesses_requester_idx" ON "book_accesses" USING btree ("requesterId","createdAt");--> statement-breakpoint
CREATE UNIQUE INDEX "book_accesses_open_idx" ON "book_accesses" USING btree ("libraryId","bookId","requesterId") WHERE "book_accesses"."status" in ('PENDING', 'APPROVED');--> statement-breakpoint
ALTER TABLE "book_accesses" ADD CONSTRAINT "status_enum_check" CHECK ("book_accesses"."status" in ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'COLLECTED'));