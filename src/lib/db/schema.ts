import {
    InferSelectModel,
    sql,
} from "drizzle-orm";

import {
    pgTable,
    uuid,
    text,
    varchar,
    integer,
    numeric,
    doublePrecision,
    jsonb,
    timestamp,
    check,
    unique,
    index,
    uniqueIndex,
    type AnyPgColumn,
} from "drizzle-orm/pg-core";

import { relations } from "drizzle-orm";


const enumText = <T extends readonly [string, ...string[]]>(values: T) =>
    text({ enum: [...values] as [T[number], ...T[number][]] });
const enumCheck = (column: AnyPgColumn, values: readonly string[]) =>
    check(
        `${column.name}_enum_check`,
        // Inline literals (constants from this file) so drizzle-kit emits valid DDL, not `$1` placeholders.
        sql`${column} in (${sql.raw(values.map(value => `'${value.replace(/'/g, "''")}'`).join(', '))})`,
    );
const createdAt = () => timestamp({ withTimezone: true, mode: 'date' }).notNull().defaultNow();
const updatedAt = () => timestamp({ withTimezone: true, mode: 'date' }).notNull().defaultNow();
const nowDate = () => timestamp({ withTimezone: true, mode: 'date' });
const id = () => uuid().primaryKey().defaultRandom();

export const userRoles = ['MEMBER', 'ADMIN'] as const;
export const bookProviderValues = ['GOOGLE_BOOKS', 'OPEN_LIBRARY', 'MANUAL', 'OTHER'] as const;
export const bookConditionValues = ['NEW', 'LIKE_NEW', 'GOOD', 'FAIR', 'POOR'] as const;
export const listingAvailabilityValues = ['AVAILABLE', 'UNAVAILABLE', 'RESERVED'] as const;
export const borrowRequestStatusValues = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'COMPLETED'] as const;
// OVERDUE is derived from dueAt at read time and never stored; DISPUTED waits for an admin decision (DEC-02).
export const borrowingStatusValues = ['ACTIVE', 'OVERDUE', 'RETURNED', 'LOST', 'CANCELLED', 'DISPUTED'] as const;
export const borrowEventTypeValues = ['REQUESTED', 'APPROVED', 'REJECTED', 'CANCELLED', 'HANDOVER_CONFIRMED', 'BORROWING_STARTED', 'RETURN_CONFIRMED', 'RETURNED', 'REMINDER_SENT', 'DISPUTE_OPENED', 'DISPUTE_RESOLVED'] as const;
export const bookAccessStatusValues = ['ACTIVE', 'REVOKED', 'EXPIRED'] as const;
export const communityStatusValues = ['PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED'] as const;
export const membershipRoleValues = ['OWNER', 'MANAGER', 'MEMBER'] as const;
export const membershipStatusValues = ['PENDING', 'ACTIVE', 'REJECTED', 'LEFT', 'REMOVED'] as const;
export const publicationStatusValues = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const;
export const eventLocationTypeValues = ['PHYSICAL', 'ONLINE'] as const;
export const merchandiseStatusValues = ['DRAFT', 'PUBLISHED', 'UNAVAILABLE', 'ARCHIVED'] as const;
export const reportStatusValues = ['PENDING', 'REVIEWING', 'RESOLVED', 'REJECTED'] as const;
export const verificationStatusValues = ['PENDING', 'APPROVED', 'REJECTED', 'REVOKED'] as const;
export const targetTypeValues = ['BOOK', 'BOOK_LISTING', 'COMMUNITY', 'EVENT', 'MERCHANDISE_LISTING', 'USER', 'BORROW_REQUEST', 'BORROWING', 'ORDER', 'OTHER'] as const;
export const orderStatusValues = ['PENDING', 'CONFIRMED', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'REFUNDED'] as const;
export const bookSyncStatusValues = ['SUCCESS', 'FAILED'] as const;
export const bookSyncTriggerValues = ['IMPORT', 'MANUAL'] as const;
export const adminAuditActionValues = ['USER_SUSPENDED', 'USER_REINSTATED', 'USER_ROLE_CHANGED', 'USER_EMAIL_REVEALED', 'SETTINGS_UPDATED', 'BORROWING_DISPUTE_RESOLVED', 'ACCOUNT_DELETED', 'RETENTION_RUN'] as const;

export const userProfiles = pgTable('user_profiles', {
    id: uuid().primaryKey(),
    displayName: text().notNull(),
    role: enumText(userRoles).notNull().default('MEMBER'),
    preferences: jsonb(),
    // App-level suspension: the account can still sign in, but every write is refused (see requireUser).
    suspendedAt: nowDate(), suspendedReason: text(),
    suspendedById: uuid().references((): AnyPgColumn => userProfiles.id, { onDelete: 'set null', onUpdate: 'cascade' }),
    // DEC-11: a deletion request deactivates the account for 14 days, then the retention job anonymises it.
    deletionRequestedAt: nowDate(), deletionScheduledFor: nowDate(), deletedAt: nowDate(), authDeletedAt: nowDate(),
    createdAt: createdAt(), updatedAt: timestamp({ withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}).enableRLS();

/** Admin actions on accounts that are not verifications: suspension, role changes, revealing a full email. */
export const adminAuditLogs = pgTable('admin_audit_logs', {
    id: id(), actorId: uuid().references(() => userProfiles.id, { onDelete: 'set null', onUpdate: 'cascade' }),
    action: enumText(adminAuditActionValues).notNull(), targetType: enumText(targetTypeValues).notNull(), targetId: uuid().notNull(),
    note: text(), metadata: jsonb(), createdAt: createdAt(),
}, t => [index('admin_audit_logs_target_idx').on(t.targetType, t.targetId, t.createdAt), enumCheck(t.action, adminAuditActionValues), enumCheck(t.targetType, targetTypeValues)]).enableRLS();

export const books = pgTable('books', {
    id: id(), provider: enumText(bookProviderValues).notNull().default('OTHER'), providerId: text().notNull(),
    isbn: text(), title: text().notNull(), authors: text().array().notNull().default(sql`'{}'::text[]`),
    description: text(), publisher: text(), publishedAt: text(), language: text(),
    categories: text().array().notNull().default(sql`'{}'::text[]`), coverUrl: text(), metadata: jsonb(),
    syncedAt: nowDate(), createdAt: createdAt(), updatedAt: updatedAt(),
}, t => [unique('books_provider_provider_id_key').on(t.provider, t.providerId), index('books_title_idx').on(t.title), index('books_isbn_idx').on(t.isbn), enumCheck(t.provider, bookProviderValues)]).enableRLS();

/** Platform settings edited in the admin portal, one JSON document per section (e.g. `catalog`). */
export const appSettings = pgTable('app_settings', {
    key: text().primaryKey(), value: jsonb().notNull(),
    updatedById: uuid().references(() => userProfiles.id, { onDelete: 'set null', onUpdate: 'cascade' }),
    updatedAt: updatedAt(),
}).enableRLS();

/** Every provider refresh of a stored catalog record, for the admin "Riwayat sinkron" trail. */
export const bookSyncLogs = pgTable('book_sync_logs', {
    id: id(), bookId: uuid().notNull().references(() => books.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    provider: enumText(bookProviderValues).notNull(), status: enumText(bookSyncStatusValues).notNull(),
    trigger: enumText(bookSyncTriggerValues).notNull(), changedFields: text().array().notNull().default(sql`'{}'::text[]`),
    message: text(), actorId: uuid().references(() => userProfiles.id, { onDelete: 'set null', onUpdate: 'cascade' }),
    createdAt: createdAt(),
}, t => [index('book_sync_logs_book_id_created_at_idx').on(t.bookId, t.createdAt), index('book_sync_logs_status_created_at_idx').on(t.status, t.createdAt), enumCheck(t.provider, bookProviderValues), enumCheck(t.status, bookSyncStatusValues), enumCheck(t.trigger, bookSyncTriggerValues)]).enableRLS();

export const bookmarks = pgTable('bookmarks', {
    id: id(), userId: uuid().notNull().references(() => userProfiles.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    bookId: uuid().notNull().references(() => books.id, { onDelete: 'cascade', onUpdate: 'cascade' }), createdAt: createdAt(),
}, t => [unique('bookmarks_user_id_book_id_key').on(t.userId, t.bookId), index('bookmarks_book_id_idx').on(t.bookId)]).enableRLS();

export const userInterests = pgTable('user_interests', {
    id: id(), userId: uuid().notNull().references(() => userProfiles.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    subject: text().notNull(), createdAt: createdAt(),
}, t => [unique('user_interests_user_id_subject_key').on(t.userId, t.subject), index('user_interests_subject_idx').on(t.subject)]).enableRLS();

export const libraries = pgTable('libraries', {
    id: id(), name: text().notNull(), publicLocation: text(), source: text(), openingHours: jsonb(), websiteUrl: text(),
    createdAt: createdAt(), updatedAt: updatedAt(),
}, t => [index('libraries_name_idx').on(t.name)]).enableRLS();

export const borrowRequests = pgTable('borrow_requests', {
    id: id(), listingId: uuid().notNull().references(() => bookListings.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    requesterId: uuid().notNull().references(() => userProfiles.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    status: enumText(borrowRequestStatusValues).notNull().default('PENDING'), note: text(),
    // Chosen from the owner's public meeting points; the loan period is capped by the listing rules.
    meetingPoint: text(), loanDays: integer().notNull().default(14), preferredTime: text(),
    rejectionReason: text(), responseNote: text(),
    // Handover needs both parties (DEC-02); the borrowing starts once both timestamps are set.
    ownerHandoverAt: nowDate(), requesterHandoverAt: nowDate(),
    cancelledById: uuid().references(() => userProfiles.id, { onDelete: 'set null', onUpdate: 'cascade' }),
    requestedAt: createdAt(), updatedAt: updatedAt(), respondedAt: nowDate(),
}, t => [
    index('borrow_requests_listing_id_status_idx').on(t.listingId, t.status), index('borrow_requests_requester_id_status_idx').on(t.requesterId, t.status), enumCheck(t.status, borrowRequestStatusValues),
    check('borrow_requests_loan_days_check', sql`${t.loanDays} between 1 and 60`),
    // One open request per reader per copy, and at most one accepted request per copy.
    uniqueIndex('borrow_requests_open_per_requester_idx').on(t.listingId, t.requesterId).where(sql`${t.status} in ('PENDING', 'APPROVED')`),
    uniqueIndex('borrow_requests_one_approved_idx').on(t.listingId).where(sql`${t.status} = 'APPROVED'`),
]).enableRLS();

export const borrowEvents = pgTable('borrow_events', {
    id: id(), requestId: uuid().notNull().references(() => borrowRequests.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    actorId: uuid().references(() => userProfiles.id, { onDelete: 'set null', onUpdate: 'cascade' }),
    type: enumText(borrowEventTypeValues).notNull(), note: text(), createdAt: createdAt(),
}, t => [index('borrow_events_request_id_idx').on(t.requestId, t.createdAt), enumCheck(t.type, borrowEventTypeValues)]).enableRLS();

export const bookAccesses = pgTable('book_accesses', {
    id: id(), requestId: uuid().notNull().unique().references(() => borrowRequests.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    status: enumText(bookAccessStatusValues).notNull().default('ACTIVE'), grantedAt: createdAt(), expiresAt: nowDate(), revokedAt: nowDate(),
    note: text(), createdAt: createdAt(), updatedAt: updatedAt(),
}, t => [index('book_accesses_status_expires_at_idx').on(t.status, t.expiresAt), index('book_accesses_granted_at_idx').on(t.grantedAt), enumCheck(t.status, bookAccessStatusValues)]).enableRLS();

export const bookListings = pgTable('book_listings', {
    id: id(), ownerId: uuid().notNull().references(() => userProfiles.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    bookId: uuid().notNull().references(() => books.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    condition: enumText(bookConditionValues).notNull(), availability: enumText(listingAvailabilityValues).notNull().default('AVAILABLE'),
    publicLocation: text(), borrowingRules: text(),
    hiddenAt: nowDate(), hiddenReason: text(), hiddenById: uuid().references(() => userProfiles.id, { onDelete: 'set null', onUpdate: 'cascade' }),
    createdAt: createdAt(), updatedAt: updatedAt(),
}, t => [index('book_listings_owner_id_idx').on(t.ownerId), index('book_listings_book_id_idx').on(t.bookId), index('book_listings_availability_idx').on(t.availability), enumCheck(t.condition, bookConditionValues), enumCheck(t.availability, listingAvailabilityValues)]).enableRLS();

export const borrowings = pgTable('borrowings', {
    id: id(), requestId: uuid().notNull().unique().references(() => borrowRequests.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    status: enumText(borrowingStatusValues).notNull().default('ACTIVE'), handedOverAt: nowDate(), dueAt: nowDate(), returnedAt: nowDate(),
    handoverProof: jsonb(), returnProof: jsonb(), note: text(),
    ownerReturnAt: nowDate(), requesterReturnAt: nowDate(), lastReminderAt: nowDate(),
    disputedAt: nowDate(), disputeReason: text(), disputeDetails: text(),
    disputedById: uuid().references(() => userProfiles.id, { onDelete: 'set null', onUpdate: 'cascade' }),
    resolvedAt: nowDate(), resolutionNote: text(),
    resolvedById: uuid().references(() => userProfiles.id, { onDelete: 'set null', onUpdate: 'cascade' }),
    createdAt: createdAt(), updatedAt: updatedAt(),
}, t => [index('borrowings_status_due_at_idx').on(t.status, t.dueAt), enumCheck(t.status, borrowingStatusValues)]).enableRLS();

export const communities = pgTable('communities', {
    id: id(), ownerId: uuid().notNull().references(() => userProfiles.id, { onDelete: 'restrict', onUpdate: 'cascade' }), name: text().notNull(),
    description: text(), publicLocation: text(), status: enumText(communityStatusValues).notNull().default('PENDING'),
    // Public contacts chosen by the owner (DEC-04); shown on the profile and used for merchandise.
    contactEmail: text(), instagramHandle: text(), whatsappNumber: text(),
    createdAt: createdAt(), updatedAt: updatedAt(),
}, t => [index('communities_owner_id_idx').on(t.ownerId), index('communities_status_idx').on(t.status), index('communities_name_idx').on(t.name), enumCheck(t.status, communityStatusValues)]).enableRLS();

/** Evidence sent with a community application or a later re-verification request (DEC-04). */
export const communitySubmissions = pgTable('community_submissions', {
    id: id(), communityId: uuid().notNull().references(() => communities.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    submittedById: uuid().references(() => userProfiles.id, { onDelete: 'set null', onUpdate: 'cascade' }),
    evidenceUrl: text().notNull(), note: text(),
    // Optional file in the private `community-evidence` storage bucket; read through signed URLs only.
    filePath: text(), fileName: text(), fileType: text(), fileSize: integer(),
    status: enumText(verificationStatusValues).notNull().default('PENDING'),
    reviewerId: uuid().references(() => userProfiles.id, { onDelete: 'set null', onUpdate: 'cascade' }), reviewNote: text(),
    createdAt: createdAt(), reviewedAt: nowDate(),
}, t => [index('community_submissions_community_idx').on(t.communityId, t.createdAt), index('community_submissions_status_idx').on(t.status, t.createdAt), enumCheck(t.status, verificationStatusValues)]).enableRLS();

/** One-time manager invitations; only the SHA-256 of the token is stored. */
export const communityInvites = pgTable('community_invites', {
    id: id(), communityId: uuid().notNull().references(() => communities.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    tokenHash: text().notNull().unique(),
    createdById: uuid().references(() => userProfiles.id, { onDelete: 'set null', onUpdate: 'cascade' }),
    expiresAt: timestamp({ withTimezone: true, mode: 'date' }).notNull(), usedAt: nowDate(),
    usedById: uuid().references(() => userProfiles.id, { onDelete: 'set null', onUpdate: 'cascade' }),
    revokedAt: nowDate(), createdAt: createdAt(),
}, t => [index('community_invites_community_idx').on(t.communityId, t.createdAt)]).enableRLS();

export const communityMemberships = pgTable('community_memberships', {
    id: id(), userId: uuid().notNull().references(() => userProfiles.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    communityId: uuid().notNull().references(() => communities.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    role: enumText(membershipRoleValues).notNull().default('MEMBER'), status: enumText(membershipStatusValues).notNull().default('PENDING'),
    createdAt: createdAt(), updatedAt: updatedAt(),
}, t => [unique('community_memberships_user_id_community_id_key').on(t.userId, t.communityId), index('community_memberships_community_role_status_idx').on(t.communityId, t.role, t.status), enumCheck(t.role, membershipRoleValues), enumCheck(t.status, membershipStatusValues)]).enableRLS();

export const events = pgTable('events', {
    id: id(), communityId: uuid().notNull().references(() => communities.id, { onDelete: 'cascade', onUpdate: 'cascade' }), title: text().notNull(),
    description: text(), startsAt: nowDate(), endsAt: nowDate(), publicLocation: text(), eventUrl: text(),
    // Figma "Buat Acara": a public venue (name + address/landmark) or an online link.
    locationType: enumText(eventLocationTypeValues).notNull().default('PHYSICAL'), venueName: text(),
    publicationStatus: enumText(publicationStatusValues).notNull().default('DRAFT'), createdAt: createdAt(), updatedAt: updatedAt(),
}, t => [index('events_community_publication_status_idx').on(t.communityId, t.publicationStatus), index('events_starts_at_idx').on(t.startsAt), enumCheck(t.publicationStatus, publicationStatusValues), enumCheck(t.locationType, eventLocationTypeValues)]).enableRLS();

export const merchandiseListings = pgTable('merchandise_listings', {
    id: id(), communityId: uuid().notNull().references(() => communities.id, { onDelete: 'cascade', onUpdate: 'cascade' }), title: text().notNull(),
    description: text(), priceAmount: numeric({ precision: 12, scale: 2 }), currency: varchar({ length: 3 }), priceNote: text(),
    availability: enumText(listingAvailabilityValues).notNull().default('AVAILABLE'), imageReference: text(),
    category: text(), stockNote: text(),
    // Null means "use the community contact"; otherwise an item-specific way to buy.
    contactOverride: text(),
    status: enumText(merchandiseStatusValues).notNull().default('DRAFT'), createdAt: createdAt(), updatedAt: updatedAt(),
}, t => [index('merchandise_listings_community_status_idx').on(t.communityId, t.status), index('merchandise_listings_availability_idx').on(t.availability), enumCheck(t.availability, listingAvailabilityValues), enumCheck(t.status, merchandiseStatusValues)]).enableRLS();

export const orders = pgTable('orders', {
    id: id(), status: enumText(orderStatusValues).notNull().default('PENDING'), currency: varchar({ length: 3 }),
    totalAmount: numeric({ precision: 12, scale: 2 }), note: text(), createdAt: createdAt(), updatedAt: updatedAt(),
}, t => [index('orders_status_created_at_idx').on(t.status, t.createdAt), enumCheck(t.status, orderStatusValues)]).enableRLS();

export const orderItems = pgTable('order_items', {
    id: id(), orderId: uuid().notNull().references(() => orders.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    merchandiseListingId: uuid().notNull().references(() => merchandiseListings.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    quantity: integer().notNull().default(1), unitPrice: numeric({ precision: 12, scale: 2 }), createdAt: createdAt(),
}, t => [unique('order_items_order_id_merchandise_listing_id_key').on(t.orderId, t.merchandiseListingId), index('order_items_merchandise_listing_id_idx').on(t.merchandiseListingId)]).enableRLS();

export const reports = pgTable('reports', {
    id: id(), reporterId: uuid().notNull().references(() => userProfiles.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    targetType: enumText(targetTypeValues).notNull(), targetId: uuid().notNull(), reason: text().notNull(), details: text(),
    status: enumText(reportStatusValues).notNull().default('PENDING'),
    reviewerId: uuid().references(() => userProfiles.id, { onDelete: 'set null', onUpdate: 'cascade' }), outcome: text(), createdAt: createdAt(), reviewedAt: nowDate(), updatedAt: updatedAt(),
    // DEC-11: details of decided reports are erased after 12 months; reason and outcome stay.
    detailsPurgedAt: nowDate(),
}, t => [index('reports_reporter_id_created_at_idx').on(t.reporterId, t.createdAt), index('reports_target_type_target_id_idx').on(t.targetType, t.targetId), index('reports_status_created_at_idx').on(t.status, t.createdAt), enumCheck(t.targetType, targetTypeValues), enumCheck(t.status, reportStatusValues)]).enableRLS();

export const recommendations = pgTable('recommendations', {
    id: id(), userId: uuid().notNull().references(() => userProfiles.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    targetType: enumText(targetTypeValues).notNull(), targetId: uuid().notNull(), score: doublePrecision(), reason: text(), modelVersion: text(), createdAt: createdAt(),
}, t => [index('recommendations_user_id_created_at_idx').on(t.userId, t.createdAt), index('recommendations_target_type_target_id_idx').on(t.targetType, t.targetId), enumCheck(t.targetType, targetTypeValues)]).enableRLS();

export const verifications = pgTable('verifications', {
    id: id(), targetType: enumText(targetTypeValues).notNull(), targetId: uuid().notNull(),
    status: enumText(verificationStatusValues).notNull().default('PENDING'),
    reviewerId: uuid().references(() => userProfiles.id, { onDelete: 'set null', onUpdate: 'cascade' }), note: text(), createdAt: createdAt(), reviewedAt: nowDate(), updatedAt: updatedAt(),
}, t => [index('verifications_target_type_target_id_idx').on(t.targetType, t.targetId), index('verifications_status_created_at_idx').on(t.status, t.createdAt), enumCheck(t.targetType, targetTypeValues), enumCheck(t.status, verificationStatusValues)]).enableRLS();


export const userProfilesRelations = relations(userProfiles, ({ many }) => ({
    bookmarks: many(bookmarks), interests: many(userInterests), bookListings: many(bookListings),
    borrowRequests: many(borrowRequests), ownedCommunities: many(communities), memberships: many(communityMemberships),
    reports: many(reports, { relationName: 'reporter' }), reviewedReports: many(reports, { relationName: 'reviewer' }),
    reviewedVerifications: many(verifications), recommendations: many(recommendations),
}));

export const booksRelations = relations(books, ({ many }) => ({ bookmarks: many(bookmarks), listings: many(bookListings), syncLogs: many(bookSyncLogs) }));
export const bookSyncLogsRelations = relations(bookSyncLogs, ({ one }) => ({ book: one(books, { fields: [bookSyncLogs.bookId], references: [books.id] }) }));
export const bookmarksRelations = relations(bookmarks, ({ one }) => ({ user: one(userProfiles, { fields: [bookmarks.userId], references: [userProfiles.id] }), book: one(books, { fields: [bookmarks.bookId], references: [books.id] }) }));
export const userInterestsRelations = relations(userInterests, ({ one }) => ({ user: one(userProfiles, { fields: [userInterests.userId], references: [userProfiles.id] }) }));
export const bookListingsRelations = relations(bookListings, ({ one, many }) => ({ ownerUser: one(userProfiles, { fields: [bookListings.ownerId], references: [userProfiles.id] }), book: one(books, { fields: [bookListings.bookId], references: [books.id] }), requests: many(borrowRequests) }));
export const borrowRequestsRelations = relations(borrowRequests, ({ one, many }) => ({ listing: one(bookListings, { fields: [borrowRequests.listingId], references: [bookListings.id] }), requester: one(userProfiles, { fields: [borrowRequests.requesterId], references: [userProfiles.id] }), borrowing: one(borrowings), access: one(bookAccesses), events: many(borrowEvents) }));
export const borrowEventsRelations = relations(borrowEvents, ({ one }) => ({ request: one(borrowRequests, { fields: [borrowEvents.requestId], references: [borrowRequests.id] }) }));
export const bookAccessesRelations = relations(bookAccesses, ({ one }) => ({ request: one(borrowRequests, { fields: [bookAccesses.requestId], references: [borrowRequests.id] }) }));
export const borrowingsRelations = relations(borrowings, ({ one }) => ({ request: one(borrowRequests, { fields: [borrowings.requestId], references: [borrowRequests.id] }) }));
export const communitiesRelations = relations(communities, ({ one, many }) => ({ owner: one(userProfiles, { fields: [communities.ownerId], references: [userProfiles.id] }), memberships: many(communityMemberships), events: many(events), merchandise: many(merchandiseListings) }));
export const communityMembershipsRelations = relations(communityMemberships, ({ one }) => ({ user: one(userProfiles, { fields: [communityMemberships.userId], references: [userProfiles.id] }), community: one(communities, { fields: [communityMemberships.communityId], references: [communities.id] }) }));
export const eventsRelations = relations(events, ({ one }) => ({ community: one(communities, { fields: [events.communityId], references: [communities.id] }) }));
export const merchandiseListingsRelations = relations(merchandiseListings, ({ one, many }) => ({ community: one(communities, { fields: [merchandiseListings.communityId], references: [communities.id] }), orderItems: many(orderItems) }));
export const ordersRelations = relations(orders, ({ many }) => ({ items: many(orderItems) }));
export const orderItemsRelations = relations(orderItems, ({ one }) => ({ order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }), merchandiseListing: one(merchandiseListings, { fields: [orderItems.merchandiseListingId], references: [merchandiseListings.id] }) }));
export const reportsRelations = relations(reports, ({ one }) => ({ reporter: one(userProfiles, { fields: [reports.reporterId], references: [userProfiles.id], relationName: 'reporter' }), reviewer: one(userProfiles, { fields: [reports.reviewerId], references: [userProfiles.id], relationName: 'reviewer' }) }));
export const recommendationsRelations = relations(recommendations, ({ one }) => ({ user: one(userProfiles, { fields: [recommendations.userId], references: [userProfiles.id] }) }));
export const verificationsRelations = relations(verifications, ({ one }) => ({ reviewer: one(userProfiles, { fields: [verifications.reviewerId], references: [userProfiles.id] }) }));

export type Book = InferSelectModel<typeof books>
