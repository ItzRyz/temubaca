ALTER TABLE "borrow_events" DROP CONSTRAINT "type_enum_check";--> statement-breakpoint
ALTER TABLE "borrow_requests" ADD COLUMN "guarantee" text;--> statement-breakpoint
ALTER TABLE "borrowings" ADD COLUMN "ownerReplyRequestedAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "borrowings" ADD COLUMN "requesterReplyRequestedAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "borrowings" ADD COLUMN "consequence" text;--> statement-breakpoint
ALTER TABLE "borrowings" ADD COLUMN "consequenceDays" integer;--> statement-breakpoint
ALTER TABLE "borrowings" ADD COLUMN "consequenceUserId" uuid;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "borrowBlockedUntil" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "borrowings" ADD CONSTRAINT "borrowings_consequenceUserId_user_profiles_id_fk" FOREIGN KEY ("consequenceUserId") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "borrow_events" ADD CONSTRAINT "type_enum_check" CHECK ("borrow_events"."type" in ('REQUESTED', 'APPROVED', 'REJECTED', 'CANCELLED', 'HANDOVER_CONFIRMED', 'BORROWING_STARTED', 'RETURN_CONFIRMED', 'RETURNED', 'REMINDER_SENT', 'DISPUTE_OPENED', 'DISPUTE_RESOLVED', 'EXTENSION_REQUESTED', 'EXTENSION_APPROVED', 'EXTENSION_REJECTED', 'DISPUTE_INFO_REQUESTED', 'DISPUTE_INFO_ADDED'));--> statement-breakpoint
ALTER TABLE "borrowings" ADD CONSTRAINT "consequence_enum_check" CHECK ("borrowings"."consequence" in ('NONE', 'WARNING', 'BORROW_BLOCK', 'SUSPENSION'));--> statement-breakpoint
ALTER TABLE "borrowings" ADD CONSTRAINT "borrowings_consequence_days_check" CHECK ("borrowings"."consequenceDays" between 1 and 365);