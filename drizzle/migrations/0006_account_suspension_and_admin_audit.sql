CREATE TABLE "admin_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actorId" uuid,
	"action" text NOT NULL,
	"targetType" text NOT NULL,
	"targetId" uuid NOT NULL,
	"note" text,
	"metadata" jsonb,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "action_enum_check" CHECK ("admin_audit_logs"."action" in ('USER_SUSPENDED', 'USER_REINSTATED', 'USER_ROLE_CHANGED', 'USER_EMAIL_REVEALED')),
	CONSTRAINT "targetType_enum_check" CHECK ("admin_audit_logs"."targetType" in ('BOOK', 'BOOK_LISTING', 'COMMUNITY', 'EVENT', 'MERCHANDISE_LISTING', 'USER', 'BORROW_REQUEST', 'BORROWING', 'ORDER', 'OTHER'))
);
--> statement-breakpoint
ALTER TABLE "admin_audit_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "suspendedAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "suspendedReason" text;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "suspendedById" uuid;--> statement-breakpoint
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_actorId_user_profiles_id_fk" FOREIGN KEY ("actorId") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "admin_audit_logs_target_idx" ON "admin_audit_logs" USING btree ("targetType","targetId","createdAt");--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_suspendedById_user_profiles_id_fk" FOREIGN KEY ("suspendedById") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE cascade;