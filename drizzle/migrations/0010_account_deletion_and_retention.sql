ALTER TABLE "admin_audit_logs" DROP CONSTRAINT "action_enum_check";--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "detailsPurgedAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "deletionRequestedAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "deletionScheduledFor" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "deletedAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "authDeletedAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "action_enum_check" CHECK ("admin_audit_logs"."action" in ('USER_SUSPENDED', 'USER_REINSTATED', 'USER_ROLE_CHANGED', 'USER_EMAIL_REVEALED', 'SETTINGS_UPDATED', 'BORROWING_DISPUTE_RESOLVED', 'ACCOUNT_DELETED', 'RETENTION_RUN'));