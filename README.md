# TemuBaca

TemuBaca is a book discovery and sharing application built with Next.js 16 App Router and TypeScript. The current app includes a local book catalog, Supabase authentication, saved books, and user-managed book listings.

## Requirements

- Bun (the repository declares Bun 1.4.2)
- PostgreSQL database
- Supabase project for authentication
- Upstash Redis REST credentials for rate-limited API routes

## Local setup

1. Install dependencies:

   ```bash
   bun install
   ```

2. Copy `.env.example` to `.env.local` and fill in the values from your PostgreSQL, Supabase, and Upstash projects.

   Keep real credentials out of source control. Environment files are ignored by Git.

3. Start the development server:

   ```bash
   bun run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Useful commands

```bash
bun run check
bun run test
bun run lint
bun run typecheck
bun run build
```

For UI review on a development database, `bun run db:seed` inserts dummy profiles, books, listings, communities, events, and merchandise; `bun run db:seed --reset` removes only those rows (fixed UUIDs prefixed `5eed0000-`). Never run it against production.

The test suite uses Bun's test runner and PGlite for isolated request parsing and migration checks. It does not replace staging tests for Supabase Auth, PostgreSQL policies, Upstash, or browser flows.

Drizzle Kit uses `src/lib/db/schema.ts` and writes generated migrations under `drizzle/migrations`. Runtime queries use `node-postgres`; set `DATABASE_URL` to the connection mode supported by your chosen host. Drizzle Kit prefers `DIRECT_URL` for migrations and falls back to `DATABASE_URL` only when unset. Confirm the target environment before generating or applying a migration:

```bash
bunx drizzle-kit generate
bunx drizzle-kit migrate
```

## Project structure

```text
temubaca/
├── public/                  # Static assets
├── drizzle/migrations/      # Drizzle-generated migration output
├── docs/                    # Product, architecture, security, and test docs
└── src/
    ├── app/
    │   ├── (app)/           # Private bookmarks, listings, and profile
    │   ├── (auth)/          # Login, registration, verification, recovery
    │   ├── (public)/        # Public home and catalog
    │   └── api/             # Route handlers
    ├── components/          # Shared UI, layout, and navigation
    ├── config/              # App metadata and navigation
    ├── features/            # Domain-specific components and actions
    ├── lib/
    │   ├── api/             # API response, validation, auth, and errors
    │   ├── auth/            # Auth/session helpers
    │   ├── db/              # Drizzle schema, client, queries, repositories
    │   ├── external/books/  # Provider-neutral catalog interface
    │   ├── logging/         # Safe server-side error logging
    │   ├── permissions/     # Role and ownership checks
    │   ├── rate-limit/      # Upstash rate-limit adapter and keys
    │   └── validation/      # Shared Zod schemas and input validators
    ├── types/
    ├── env.ts
    └── proxy.ts
```

## Current routes

| Route | Purpose |
| --- | --- |
| `/books` | Search the local book catalog |
| `/books/[bookId]` | Book details, available shared copies, and bookmark/listing actions |
| `/login`, `/register` | Authentication |
| `/bookmarks` | Signed-in user's saved books |
| `/my-listings` | Signed-in user's shared book listings |
| `/profile` | Signed-in user's profile shortcuts |
| `/api/books/search` | Paginated local catalog search |
| `/api/books/[bookId]` | Read one local catalog record |
| `/api/bookmarks/[bookId]` | Add or remove the signed-in user's bookmark |
| `/api/book-listings` | List or create the signed-in user's listings |
| `/api/book-listings/[listingId]` | Update a listing owned by the signed-in user |

## Integrations and decisions

- Book search currently uses the local PostgreSQL catalog. The provider-neutral interface in `src/lib/external/books/` is preparation only; no external catalog provider is selected or activated. See [the provider review](docs/BOOK_CATALOG_PROVIDER_REVIEW.md). `DEC-06` remains open.
- Recommendation service settings are optional and no recommendation provider is active.
- Checkout and payment work is not implemented; do not proceed until `DEC-03` is explicitly decided.
- Deployment and production environment settings are not prescribed by this repository.

## Environment variables

`DATABASE_URL`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are validated as required by `src/env.ts`. The Upstash variables are read by the rate-limit provider and must be present when rate-limited routes are used.

`DIRECT_URL`, `DATABASE_SSL_CA`, `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_BOOKS_API_KEY`, `RECOMMENDATION_API_URL`, `RECOMMENDATION_API_KEY`, and `INTERNAL_API_SECRET` are optional in the current environment schema. `DATABASE_SSL_CA` is an optional PEM-encoded CA certificate added to Node's default CA roots for database TLS. Its presence does not bypass certificate/hostname verification. Their presence does not mean the corresponding integration is selected or enabled. `DIRECT_URL` is used by Drizzle Kit migrations when set. `OPEN_LIBRARY_BASE_URL` defaults to `https://openlibrary.org`; the current app does not make external catalog requests.

The `.env.example` file contains placeholders only. Credentials previously present in the local sample must be rotated before production if they were valid.
