ALTER TABLE "admin_audit_logs" DROP CONSTRAINT "action_enum_check";--> statement-breakpoint
ALTER TABLE "events" DROP CONSTRAINT "publicationStatus_enum_check";--> statement-breakpoint
ALTER TABLE "merchandise_listings" DROP CONSTRAINT "status_enum_check";--> statement-breakpoint
ALTER TABLE "borrowings" ADD COLUMN "extensionCount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "moderationNote" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "reviewedAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "merchandise_listings" ADD COLUMN "moderationNote" text;--> statement-breakpoint
ALTER TABLE "merchandise_listings" ADD COLUMN "reviewedAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "districtCode" text;--> statement-breakpoint
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "action_enum_check" CHECK ("admin_audit_logs"."action" in ('USER_SUSPENDED', 'USER_REINSTATED', 'USER_ROLE_CHANGED', 'USER_EMAIL_REVEALED', 'SETTINGS_UPDATED', 'BORROWING_DISPUTE_RESOLVED', 'ACCOUNT_DELETED', 'RETENTION_RUN', 'PLACE_CREATED', 'PLACE_UPDATED', 'PLACE_HIDDEN', 'PLACE_RESTORED', 'LIBRARY_CREATED', 'LIBRARY_UPDATED', 'LIBRARY_MANAGER_ADDED', 'LIBRARY_MANAGER_REMOVED', 'LIBRARY_HOLDING_CHANGED', 'CONTENT_APPROVED', 'CONTENT_REJECTED'));--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "publicationStatus_enum_check" CHECK ("events"."publicationStatus" in ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'ARCHIVED'));--> statement-breakpoint
ALTER TABLE "merchandise_listings" ADD CONSTRAINT "status_enum_check" CHECK ("merchandise_listings"."status" in ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'UNAVAILABLE', 'ARCHIVED'));--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_district_code_check" CHECK ("user_profiles"."districtCode" ~ '^[0-9]{2}[.][0-9]{2}[.][0-9]{2}$');--> statement-breakpoint
-- Loans that already used their one extension.
UPDATE "borrowings" SET "extensionCount" = 1 WHERE "extensionStatus" IS NOT NULL;