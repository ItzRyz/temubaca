CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updatedById" uuid,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "admin_audit_logs" DROP CONSTRAINT "action_enum_check";--> statement-breakpoint
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_updatedById_user_profiles_id_fk" FOREIGN KEY ("updatedById") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "action_enum_check" CHECK ("admin_audit_logs"."action" in ('USER_SUSPENDED', 'USER_REINSTATED', 'USER_ROLE_CHANGED', 'USER_EMAIL_REVEALED', 'SETTINGS_UPDATED'));