ALTER TABLE "borrow_events" DROP CONSTRAINT "type_enum_check";--> statement-breakpoint
ALTER TABLE "borrowings" ADD COLUMN "extensionStatus" text;--> statement-breakpoint
ALTER TABLE "borrowings" ADD COLUMN "extensionDays" integer;--> statement-breakpoint
ALTER TABLE "borrowings" ADD COLUMN "extensionNote" text;--> statement-breakpoint
ALTER TABLE "borrowings" ADD COLUMN "extensionRequestedAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "borrowings" ADD COLUMN "extensionRespondedAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "borrowings" ADD COLUMN "extensionResponseNote" text;--> statement-breakpoint
ALTER TABLE "borrow_events" ADD CONSTRAINT "type_enum_check" CHECK ("borrow_events"."type" in ('REQUESTED', 'APPROVED', 'REJECTED', 'CANCELLED', 'HANDOVER_CONFIRMED', 'BORROWING_STARTED', 'RETURN_CONFIRMED', 'RETURNED', 'REMINDER_SENT', 'DISPUTE_OPENED', 'DISPUTE_RESOLVED', 'EXTENSION_REQUESTED', 'EXTENSION_APPROVED', 'EXTENSION_REJECTED'));--> statement-breakpoint
ALTER TABLE "borrowings" ADD CONSTRAINT "extensionStatus_enum_check" CHECK ("borrowings"."extensionStatus" in ('PENDING', 'APPROVED', 'REJECTED'));--> statement-breakpoint
ALTER TABLE "borrowings" ADD CONSTRAINT "borrowings_extension_days_check" CHECK ("borrowings"."extensionDays" between 1 and 14);