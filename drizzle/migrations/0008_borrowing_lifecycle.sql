CREATE TABLE "borrow_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requestId" uuid NOT NULL,
	"actorId" uuid,
	"type" text NOT NULL,
	"note" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "type_enum_check" CHECK ("borrow_events"."type" in ('REQUESTED', 'APPROVED', 'REJECTED', 'CANCELLED', 'HANDOVER_CONFIRMED', 'BORROWING_STARTED', 'RETURN_CONFIRMED', 'RETURNED', 'REMINDER_SENT', 'DISPUTE_OPENED', 'DISPUTE_RESOLVED'))
);
--> statement-breakpoint
ALTER TABLE "borrow_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "admin_audit_logs" DROP CONSTRAINT "action_enum_check";--> statement-breakpoint
ALTER TABLE "borrowings" DROP CONSTRAINT "status_enum_check";--> statement-breakpoint
ALTER TABLE "borrow_requests" ADD COLUMN "meetingPoint" text;--> statement-breakpoint
ALTER TABLE "borrow_requests" ADD COLUMN "loanDays" integer DEFAULT 14 NOT NULL;--> statement-breakpoint
ALTER TABLE "borrow_requests" ADD COLUMN "preferredTime" text;--> statement-breakpoint
ALTER TABLE "borrow_requests" ADD COLUMN "rejectionReason" text;--> statement-breakpoint
ALTER TABLE "borrow_requests" ADD COLUMN "responseNote" text;--> statement-breakpoint
ALTER TABLE "borrow_requests" ADD COLUMN "ownerHandoverAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "borrow_requests" ADD COLUMN "requesterHandoverAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "borrow_requests" ADD COLUMN "cancelledById" uuid;--> statement-breakpoint
ALTER TABLE "borrowings" ADD COLUMN "ownerReturnAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "borrowings" ADD COLUMN "requesterReturnAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "borrowings" ADD COLUMN "lastReminderAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "borrowings" ADD COLUMN "disputedAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "borrowings" ADD COLUMN "disputeReason" text;--> statement-breakpoint
ALTER TABLE "borrowings" ADD COLUMN "disputeDetails" text;--> statement-breakpoint
ALTER TABLE "borrowings" ADD COLUMN "disputedById" uuid;--> statement-breakpoint
ALTER TABLE "borrowings" ADD COLUMN "resolvedAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "borrowings" ADD COLUMN "resolutionNote" text;--> statement-breakpoint
ALTER TABLE "borrowings" ADD COLUMN "resolvedById" uuid;--> statement-breakpoint
ALTER TABLE "borrow_events" ADD CONSTRAINT "borrow_events_requestId_borrow_requests_id_fk" FOREIGN KEY ("requestId") REFERENCES "public"."borrow_requests"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "borrow_events" ADD CONSTRAINT "borrow_events_actorId_user_profiles_id_fk" FOREIGN KEY ("actorId") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "borrow_events_request_id_idx" ON "borrow_events" USING btree ("requestId","createdAt");--> statement-breakpoint
ALTER TABLE "borrow_requests" ADD CONSTRAINT "borrow_requests_cancelledById_user_profiles_id_fk" FOREIGN KEY ("cancelledById") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "borrowings" ADD CONSTRAINT "borrowings_disputedById_user_profiles_id_fk" FOREIGN KEY ("disputedById") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "borrowings" ADD CONSTRAINT "borrowings_resolvedById_user_profiles_id_fk" FOREIGN KEY ("resolvedById") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "borrow_requests_open_per_requester_idx" ON "borrow_requests" USING btree ("listingId","requesterId") WHERE "borrow_requests"."status" in ('PENDING', 'APPROVED');--> statement-breakpoint
CREATE UNIQUE INDEX "borrow_requests_one_approved_idx" ON "borrow_requests" USING btree ("listingId") WHERE "borrow_requests"."status" = 'APPROVED';--> statement-breakpoint
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "action_enum_check" CHECK ("admin_audit_logs"."action" in ('USER_SUSPENDED', 'USER_REINSTATED', 'USER_ROLE_CHANGED', 'USER_EMAIL_REVEALED', 'SETTINGS_UPDATED', 'BORROWING_DISPUTE_RESOLVED'));--> statement-breakpoint
ALTER TABLE "borrow_requests" ADD CONSTRAINT "borrow_requests_loan_days_check" CHECK ("borrow_requests"."loanDays" between 1 and 60);--> statement-breakpoint
ALTER TABLE "borrowings" ADD CONSTRAINT "status_enum_check" CHECK ("borrowings"."status" in ('ACTIVE', 'OVERDUE', 'RETURNED', 'LOST', 'CANCELLED', 'DISPUTED'));