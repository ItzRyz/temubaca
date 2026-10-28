ALTER TABLE "library_holdings" DROP CONSTRAINT "source_enum_check";--> statement-breakpoint
ALTER TABLE "books" DROP COLUMN "librariesCheckedAt";--> statement-breakpoint
ALTER TABLE "libraries" DROP COLUMN "oneSearchInstitution";--> statement-breakpoint
ALTER TABLE "library_holdings" ADD CONSTRAINT "source_enum_check" CHECK ("library_holdings"."source" in ('CURATED', 'MANAGER'));