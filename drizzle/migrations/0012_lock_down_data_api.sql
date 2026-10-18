-- TB-049: the app reaches Postgres directly (Drizzle), never through the Supabase Data API.
-- 1. anon/authenticated lose every table privilege in public, now and for future tables, so the
--    publishable key cannot reach data even if a policy is added by mistake.
-- 2. The SECURITY DEFINER trigger functions are not callable by API roles.
-- 3. temubaca_app is the least-privilege runtime role: CRUD only, no DDL, no BYPASSRLS. Every
--    table gets an explicit policy for it; new tables must add the same policy (checked in tests).
--    LOGIN and its password are set outside migrations (scripts/runtime-role.ts).
DO $$
DECLARE api_role text;
BEGIN
    FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
            EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', api_role);
            EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', api_role);
        END IF;
    END LOOP;
END $$;
--> statement-breakpoint
DO $$
DECLARE fn text;
BEGIN
    FOREACH fn IN ARRAY ARRAY['public.handle_new_user()', 'public.rls_auto_enable()'] LOOP
        IF to_regprocedure(fn) IS NOT NULL THEN
            EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', fn);
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
                EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon, authenticated', fn);
            END IF;
        END IF;
    END LOOP;
END $$;
--> statement-breakpoint
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'temubaca_app') THEN
        CREATE ROLE temubaca_app NOLOGIN NOINHERIT;
    END IF;
END $$;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO temubaca_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO temubaca_app;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO temubaca_app;
--> statement-breakpoint
DO $$
DECLARE t record;
BEGIN
    FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t.tablename AND policyname = 'temubaca_app_all') THEN
            EXECUTE format('CREATE POLICY temubaca_app_all ON public.%I TO temubaca_app USING (true) WITH CHECK (true)', t.tablename);
        END IF;
    END LOOP;
END $$;
