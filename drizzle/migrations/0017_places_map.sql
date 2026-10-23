CREATE TABLE "places" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"addressPublic" text,
	"latitude" numeric(8, 6) NOT NULL,
	"longitude" numeric(9, 6) NOT NULL,
	"regionCode" text,
	"communityId" uuid,
	"eventId" uuid,
	"source" text,
	"checkedAt" timestamp with time zone,
	"hiddenAt" timestamp with time zone,
	"hiddenReason" text,
	"createdById" uuid,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "places_community_id_key" UNIQUE("communityId"),
	CONSTRAINT "places_event_id_key" UNIQUE("eventId"),
	CONSTRAINT "type_enum_check" CHECK ("places"."type" in ('LIBRARY', 'COMMUNITY', 'EVENT', 'MEETING_POINT')),
	CONSTRAINT "places_coordinates_check" CHECK ("places"."latitude" between -11.5 and 6.5 and "places"."longitude" between 94.5 and 141.5),
	CONSTRAINT "places_region_code_check" CHECK ("places"."regionCode" ~ '^[0-9]{2}[.][0-9]{2}$'),
	CONSTRAINT "places_owner_check" CHECK (("places"."type" = 'COMMUNITY') = ("places"."communityId" is not null) and ("places"."type" = 'EVENT') = ("places"."eventId" is not null))
);
--> statement-breakpoint
ALTER TABLE "places" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "admin_audit_logs" DROP CONSTRAINT "action_enum_check";--> statement-breakpoint
ALTER TABLE "admin_audit_logs" DROP CONSTRAINT "targetType_enum_check";--> statement-breakpoint
ALTER TABLE "recommendations" DROP CONSTRAINT "targetType_enum_check";--> statement-breakpoint
ALTER TABLE "reports" DROP CONSTRAINT "targetType_enum_check";--> statement-breakpoint
ALTER TABLE "verifications" DROP CONSTRAINT "targetType_enum_check";--> statement-breakpoint
ALTER TABLE "places" ADD CONSTRAINT "places_communityId_communities_id_fk" FOREIGN KEY ("communityId") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "places" ADD CONSTRAINT "places_eventId_events_id_fk" FOREIGN KEY ("eventId") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "places" ADD CONSTRAINT "places_createdById_user_profiles_id_fk" FOREIGN KEY ("createdById") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "places_type_idx" ON "places" USING btree ("type");--> statement-breakpoint
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "action_enum_check" CHECK ("admin_audit_logs"."action" in ('USER_SUSPENDED', 'USER_REINSTATED', 'USER_ROLE_CHANGED', 'USER_EMAIL_REVEALED', 'SETTINGS_UPDATED', 'BORROWING_DISPUTE_RESOLVED', 'ACCOUNT_DELETED', 'RETENTION_RUN', 'PLACE_CREATED', 'PLACE_UPDATED', 'PLACE_HIDDEN', 'PLACE_RESTORED'));--> statement-breakpoint
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "targetType_enum_check" CHECK ("admin_audit_logs"."targetType" in ('BOOK', 'BOOK_LISTING', 'COMMUNITY', 'EVENT', 'MERCHANDISE_LISTING', 'USER', 'BORROW_REQUEST', 'BORROWING', 'ORDER', 'PLACE', 'OTHER'));--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "targetType_enum_check" CHECK ("recommendations"."targetType" in ('BOOK', 'BOOK_LISTING', 'COMMUNITY', 'EVENT', 'MERCHANDISE_LISTING', 'USER', 'BORROW_REQUEST', 'BORROWING', 'ORDER', 'PLACE', 'OTHER'));--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "targetType_enum_check" CHECK ("reports"."targetType" in ('BOOK', 'BOOK_LISTING', 'COMMUNITY', 'EVENT', 'MERCHANDISE_LISTING', 'USER', 'BORROW_REQUEST', 'BORROWING', 'ORDER', 'PLACE', 'OTHER'));--> statement-breakpoint
ALTER TABLE "verifications" ADD CONSTRAINT "targetType_enum_check" CHECK ("verifications"."targetType" in ('BOOK', 'BOOK_LISTING', 'COMMUNITY', 'EVENT', 'MERCHANDISE_LISTING', 'USER', 'BORROW_REQUEST', 'BORROWING', 'ORDER', 'PLACE', 'OTHER'));--> statement-breakpoint
-- The runtime role reads and writes through RLS like every other table (migration 0012 policy).
CREATE POLICY temubaca_app_all ON public.places TO temubaca_app USING (true) WITH CHECK (true);
