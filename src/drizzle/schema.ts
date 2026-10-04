import { sql } from 'drizzle-orm';
import {
    pgTable, uuid, text, varchar, integer, numeric, doublePrecision, jsonb,
    timestamp, check, unique, index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

const enumText = (values: readonly string[]) => text({ enum: [...values] as [string, ...string[]] });
const enumCheck = (column: any, values: readonly string[]) => {
    const literals = values.map(value => `'${value.replaceAll("'", "''")}'`).join(', ');
    return check(`${column.name}_enum_check`, sql`${column} in (${sql.raw(literals)})`);
};
const createdAt = () => timestamp({ withTimezone: true, mode: 'date' }).notNull().defaultNow();
const updatedAt = () => timestamp({ withTimezone: true, mode: 'date' }).notNull();
const nowDate = () => timestamp({ withTimezone: true, mode: 'date' });
const id = () => uuid().primaryKey().defaultRandom();

export const bookProviderValues = ['GOOGLE_BOOKS', 'OPEN_LIBRARY', 'MANUAL', 'OTHER'] as const;
export const bookConditionValues = ['NEW', 'LIKE_NEW', 'GOOD', 'FAIR', 'POOR'] as const;
export const listingAvailabilityValues = ['AVAILABLE', 'UNAVAILABLE', 'RESERVED'] as const;
export const borrowRequestStatusValues = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'COMPLETED'] as const;
export const borrowingStatusValues = ['ACTIVE', 'OVERDUE', 'RETURNED', 'LOST', 'CANCELLED'] as const;
export const bookAccessStatusValues = ['ACTIVE', 'REVOKED', 'EXPIRED'] as const;
export const communityStatusValues = ['PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED'] as const;
export const membershipRoleValues = ['OWNER', 'MANAGER', 'MEMBER'] as const;
export const membershipStatusValues = ['PENDING', 'ACTIVE', 'REJECTED', 'LEFT', 'REMOVED'] as const;
export const publicationStatusValues = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const;
export const merchandiseStatusValues = ['DRAFT', 'PUBLISHED', 'UNAVAILABLE', 'ARCHIVED'] as const;
export const reportStatusValues = ['PENDING', 'REVIEWING', 'RESOLVED', 'REJECTED'] as const;
export const verificationStatusValues = ['PENDING', 'APPROVED', 'REJECTED', 'REVOKED'] as const;
export const targetTypeValues = ['BOOK', 'BOOK_LISTING', 'COMMUNITY', 'EVENT', 'MERCHANDISE_LISTING', 'USER', 'BORROW_REQUEST', 'BORROWING', 'ORDER', 'OTHER'] as const;
export const orderStatusValues = ['PENDING', 'CONFIRMED', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'REFUNDED'] as const;

export const userProfiles = pgTable('user_profiles', {
    id: uuid().primaryKey(), displayName: text().notNull(), preferences: jsonb(),
    createdAt: createdAt(), updatedAt: updatedAt(),
});

export const books = pgTable('books', {
    id: id(), provider: enumText(bookProviderValues).notNull().default('OTHER'), providerId: text().notNull(),
    isbn: text(), title: text().notNull(), authors: text().array().notNull().default(sql`'{}'::text[]`),
    description: text(), publisher: text(), publishedAt: text(), language: text(),
    categories: text().array().notNull().default(sql`'{}'::text[]`), coverUrl: text(), metadata: jsonb(),
    createdAt: createdAt(), updatedAt: updatedAt(),
}, t => [unique('books_provider_provider_id_key').on(t.provider, t.providerId), index('books_title_idx').on(t.title), index('books_isbn_idx').on(t.isbn), enumCheck(t.provider, bookProviderValues)]);

export const bookmarks = pgTable('bookmarks', {
    id: id(), userId: uuid().notNull().references(() => userProfiles.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    bookId: uuid().notNull().references(() => books.id, { onDelete: 'cascade', onUpdate: 'cascade' }), createdAt: createdAt(),
}, t => [unique('bookmarks_user_id_book_id_key').on(t.userId, t.bookId), index('bookmarks_book_id_idx').on(t.bookId)]);

export const userInterests = pgTable('user_interests', {
    id: id(), userId: uuid().notNull().references(() => userProfiles.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    subject: text().notNull(), createdAt: createdAt(),
}, t => [unique('user_interests_user_id_subject_key').on(t.userId, t.subject), index('user_interests_subject_idx').on(t.subject)]);

export const libraries = pgTable('libraries', {
    id: id(), name: text().notNull(), publicLocation: text(), source: text(), openingHours: jsonb(), websiteUrl: text(),
    createdAt: createdAt(), updatedAt: updatedAt(),
}, t => [index('libraries_name_idx').on(t.name)]);

export const borrowRequests = pgTable('borrow_requests', {
    id: id(), listingId: uuid().notNull().references(() => bookListings.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    requesterId: uuid().notNull().references(() => userProfiles.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    status: enumText(borrowRequestStatusValues).notNull().default('PENDING'), note: text(),
    requestedAt: createdAt(), updatedAt: updatedAt(), respondedAt: nowDate(),
}, t => [index('borrow_requests_listing_id_status_idx').on(t.listingId, t.status), index('borrow_requests_requester_id_status_idx').on(t.requesterId, t.status), enumCheck(t.status, borrowRequestStatusValues)]);

export const bookAccesses = pgTable('book_accesses', {
    id: id(), requestId: uuid().notNull().unique().references(() => borrowRequests.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    status: enumText(bookAccessStatusValues).notNull().default('ACTIVE'), grantedAt: createdAt(), expiresAt: nowDate(), revokedAt: nowDate(),
    note: text(), createdAt: createdAt(), updatedAt: updatedAt(),
}, t => [index('book_accesses_status_expires_at_idx').on(t.status, t.expiresAt), index('book_accesses_granted_at_idx').on(t.grantedAt), enumCheck(t.status, bookAccessStatusValues)]);

export const bookListings = pgTable('book_listings', {
    id: id(), ownerId: uuid().notNull().references(() => userProfiles.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    bookId: uuid().notNull().references(() => books.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    condition: enumText(bookConditionValues).notNull(), availability: enumText(listingAvailabilityValues).notNull().default('AVAILABLE'),
    publicLocation: text(), borrowingRules: text(), createdAt: createdAt(), updatedAt: updatedAt(),
}, t => [index('book_listings_owner_id_idx').on(t.ownerId), index('book_listings_book_id_idx').on(t.bookId), index('book_listings_availability_idx').on(t.availability), enumCheck(t.condition, bookConditionValues), enumCheck(t.availability, listingAvailabilityValues)]);

export const borrowings = pgTable('borrowings', {
    id: id(), requestId: uuid().notNull().unique().references(() => borrowRequests.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    status: enumText(borrowingStatusValues).notNull().default('ACTIVE'), handedOverAt: nowDate(), dueAt: nowDate(), returnedAt: nowDate(),
    handoverProof: jsonb(), returnProof: jsonb(), note: text(), createdAt: createdAt(), updatedAt: updatedAt(),
}, t => [index('borrowings_status_due_at_idx').on(t.status, t.dueAt), enumCheck(t.status, borrowingStatusValues)]);

export const communities = pgTable('communities', {
    id: id(), ownerId: uuid().notNull().references(() => userProfiles.id, { onDelete: 'restrict', onUpdate: 'cascade' }), name: text().notNull(),
    description: text(), publicLocation: text(), status: enumText(communityStatusValues).notNull().default('PENDING'),
    createdAt: createdAt(), updatedAt: updatedAt(),
}, t => [index('communities_owner_id_idx').on(t.ownerId), index('communities_status_idx').on(t.status), index('communities_name_idx').on(t.name), enumCheck(t.status, communityStatusValues)]);

export const communityMemberships = pgTable('community_memberships', {
    id: id(), userId: uuid().notNull().references(() => userProfiles.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    communityId: uuid().notNull().references(() => communities.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    role: enumText(membershipRoleValues).notNull().default('MEMBER'), status: enumText(membershipStatusValues).notNull().default('PENDING'),
    createdAt: createdAt(), updatedAt: updatedAt(),
}, t => [unique('community_memberships_user_id_community_id_key').on(t.userId, t.communityId), index('community_memberships_community_role_status_idx').on(t.communityId, t.role, t.status), enumCheck(t.role, membershipRoleValues), enumCheck(t.status, membershipStatusValues)]);

export const events = pgTable('events', {
    id: id(), communityId: uuid().notNull().references(() => communities.id, { onDelete: 'cascade', onUpdate: 'cascade' }), title: text().notNull(),
    description: text(), startsAt: nowDate(), endsAt: nowDate(), publicLocation: text(), eventUrl: text(),
    publicationStatus: enumText(publicationStatusValues).notNull().default('DRAFT'), createdAt: createdAt(), updatedAt: updatedAt(),
}, t => [index('events_community_publication_status_idx').on(t.communityId, t.publicationStatus), index('events_starts_at_idx').on(t.startsAt), enumCheck(t.publicationStatus, publicationStatusValues)]);

export const merchandiseListings = pgTable('merchandise_listings', {
    id: id(), communityId: uuid().notNull().references(() => communities.id, { onDelete: 'cascade', onUpdate: 'cascade' }), title: text().notNull(),
    description: text(), priceAmount: numeric({ precision: 12, scale: 2 }), currency: varchar({ length: 3 }), priceNote: text(),
    availability: enumText(listingAvailabilityValues).notNull().default('AVAILABLE'), imageReference: text(),
    status: enumText(merchandiseStatusValues).notNull().default('DRAFT'), createdAt: createdAt(), updatedAt: updatedAt(),
}, t => [index('merchandise_listings_community_status_idx').on(t.communityId, t.status), index('merchandise_listings_availability_idx').on(t.availability), enumCheck(t.availability, listingAvailabilityValues), enumCheck(t.status, merchandiseStatusValues)]);

export const orders = pgTable('orders', {
    id: id(), status: enumText(orderStatusValues).notNull().default('PENDING'), currency: varchar({ length: 3 }),
    totalAmount: numeric({ precision: 12, scale: 2 }), note: text(), createdAt: createdAt(), updatedAt: updatedAt(),
}, t => [index('orders_status_created_at_idx').on(t.status, t.createdAt), enumCheck(t.status, orderStatusValues)]);

export const orderItems = pgTable('order_items', {
    id: id(), orderId: uuid().notNull().references(() => orders.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    merchandiseListingId: uuid().notNull().references(() => merchandiseListings.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    quantity: integer().notNull().default(1), unitPrice: numeric({ precision: 12, scale: 2 }), createdAt: createdAt(),
}, t => [unique('order_items_order_id_merchandise_listing_id_key').on(t.orderId, t.merchandiseListingId), index('order_items_merchandise_listing_id_idx').on(t.merchandiseListingId)]);

export const reports = pgTable('reports', {
    id: id(), reporterId: uuid().notNull().references(() => userProfiles.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    targetType: enumText(targetTypeValues).notNull(), targetId: uuid().notNull(), reason: text().notNull(), details: text(),
    status: enumText(reportStatusValues).notNull().default('PENDING'),
    reviewerId: uuid().references(() => userProfiles.id, { onDelete: 'set null', onUpdate: 'cascade' }), outcome: text(), createdAt: createdAt(), reviewedAt: nowDate(), updatedAt: updatedAt(),
}, t => [index('reports_reporter_id_created_at_idx').on(t.reporterId, t.createdAt), index('reports_target_type_target_id_idx').on(t.targetType, t.targetId), index('reports_status_created_at_idx').on(t.status, t.createdAt), enumCheck(t.targetType, targetTypeValues), enumCheck(t.status, reportStatusValues)]);

export const recommendations = pgTable('recommendations', {
    id: id(), userId: uuid().notNull().references(() => userProfiles.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    targetType: enumText(targetTypeValues).notNull(), targetId: uuid().notNull(), score: doublePrecision(), reason: text(), modelVersion: text(), createdAt: createdAt(),
}, t => [index('recommendations_user_id_created_at_idx').on(t.userId, t.createdAt), index('recommendations_target_type_target_id_idx').on(t.targetType, t.targetId), enumCheck(t.targetType, targetTypeValues)]);

export const verifications = pgTable('verifications', {
    id: id(), targetType: enumText(targetTypeValues).notNull(), targetId: uuid().notNull(),
    status: enumText(verificationStatusValues).notNull().default('PENDING'),
    reviewerId: uuid().references(() => userProfiles.id, { onDelete: 'set null', onUpdate: 'cascade' }), note: text(), createdAt: createdAt(), reviewedAt: nowDate(), updatedAt: updatedAt(),
}, t => [index('verifications_target_type_target_id_idx').on(t.targetType, t.targetId), index('verifications_status_created_at_idx').on(t.status, t.createdAt), enumCheck(t.targetType, targetTypeValues), enumCheck(t.status, verificationStatusValues)]);


export const userProfilesRelations = relations(userProfiles, ({ many }) => ({
    bookmarks: many(bookmarks), interests: many(userInterests), bookListings: many(bookListings),
    borrowRequests: many(borrowRequests), ownedCommunities: many(communities), memberships: many(communityMemberships),
    reports: many(reports, { relationName: 'reporter' }), reviewedReports: many(reports, { relationName: 'reviewer' }),
    reviewedVerifications: many(verifications), recommendations: many(recommendations),
}));

export const booksRelations = relations(books, ({ many }) => ({ bookmarks: many(bookmarks), listings: many(bookListings) }));
export const bookmarksRelations = relations(bookmarks, ({ one }) => ({ user: one(userProfiles, { fields: [bookmarks.userId], references: [userProfiles.id] }), book: one(books, { fields: [bookmarks.bookId], references: [books.id] }) }));
export const userInterestsRelations = relations(userInterests, ({ one }) => ({ user: one(userProfiles, { fields: [userInterests.userId], references: [userProfiles.id] }) }));
export const bookListingsRelations = relations(bookListings, ({ one, many }) => ({ ownerUser: one(userProfiles, { fields: [bookListings.ownerId], references: [userProfiles.id] }), book: one(books, { fields: [bookListings.bookId], references: [books.id] }), requests: many(borrowRequests) }));
export const borrowRequestsRelations = relations(borrowRequests, ({ one }) => ({ listing: one(bookListings, { fields: [borrowRequests.listingId], references: [bookListings.id] }), requester: one(userProfiles, { fields: [borrowRequests.requesterId], references: [userProfiles.id] }), borrowing: one(borrowings), access: one(bookAccesses) }));
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
