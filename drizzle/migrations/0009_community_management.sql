CREATE TABLE "community_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"communityId" uuid NOT NULL,
	"tokenHash" text NOT NULL,
	"createdById" uuid,
	"expiresAt" timestamp with time zone NOT NULL,
	"usedAt" timestamp with time zone,
	"usedById" uuid,
	"revokedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "community_invites_tokenHash_unique" UNIQUE("tokenHash")
);
--> statement-breakpoint
ALTER TABLE "community_invites" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "community_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"communityId" uuid NOT NULL,
	"submittedById" uuid,
	"evidenceUrl" text NOT NULL,
	"note" text,
	"filePath" text,
	"fileName" text,
	"fileType" text,
	"fileSize" integer,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"reviewerId" uuid,
	"reviewNote" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewedAt" timestamp with time zone,
	CONSTRAINT "status_enum_check" CHECK ("community_submissions"."status" in ('PENDING', 'APPROVED', 'REJECTED', 'REVOKED'))
);
--> statement-breakpoint
ALTER TABLE "community_submissions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "communities" ADD COLUMN "contactEmail" text;--> statement-breakpoint
ALTER TABLE "communities" ADD COLUMN "instagramHandle" text;--> statement-breakpoint
ALTER TABLE "communities" ADD COLUMN "whatsappNumber" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "locationType" text DEFAULT 'PHYSICAL' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "venueName" text;--> statement-breakpoint
ALTER TABLE "merchandise_listings" ADD COLUMN "category" text;--> statement-breakpoint
ALTER TABLE "merchandise_listings" ADD COLUMN "stockNote" text;--> statement-breakpoint
ALTER TABLE "merchandise_listings" ADD COLUMN "contactOverride" text;--> statement-breakpoint
ALTER TABLE "community_invites" ADD CONSTRAINT "community_invites_communityId_communities_id_fk" FOREIGN KEY ("communityId") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "community_invites" ADD CONSTRAINT "community_invites_createdById_user_profiles_id_fk" FOREIGN KEY ("createdById") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "community_invites" ADD CONSTRAINT "community_invites_usedById_user_profiles_id_fk" FOREIGN KEY ("usedById") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "community_submissions" ADD CONSTRAINT "community_submissions_communityId_communities_id_fk" FOREIGN KEY ("communityId") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "community_submissions" ADD CONSTRAINT "community_submissions_submittedById_user_profiles_id_fk" FOREIGN KEY ("submittedById") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "community_submissions" ADD CONSTRAINT "community_submissions_reviewerId_user_profiles_id_fk" FOREIGN KEY ("reviewerId") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "community_invites_community_idx" ON "community_invites" USING btree ("communityId","createdAt");--> statement-breakpoint
CREATE INDEX "community_submissions_community_idx" ON "community_submissions" USING btree ("communityId","createdAt");--> statement-breakpoint
CREATE INDEX "community_submissions_status_idx" ON "community_submissions" USING btree ("status","createdAt");--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "locationType_enum_check" CHECK ("events"."locationType" in ('PHYSICAL', 'ONLINE'));