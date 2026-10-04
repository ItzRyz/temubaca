-- Keep the Supabase Auth trigger aligned with the quoted camelCase columns
-- created by the Drizzle user_profiles schema.
ALTER TABLE public.user_profiles
    ALTER COLUMN "updatedAt" SET DEFAULT now();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
    INSERT INTO public.user_profiles (
        id,
        "displayName",
        "createdAt",
        "updatedAt"
    )
    VALUES (
        NEW.id,
        COALESCE(
            NULLIF(BTRIM(NEW.raw_user_meta_data ->> 'display_name'), ''),
            NULLIF(BTRIM(NEW.raw_user_meta_data ->> 'full_name'), ''),
            SPLIT_PART(COALESCE(NEW.email, 'user'), '@', 1)
        ),
        now(),
        now()
    )
    ON CONFLICT (id) DO UPDATE
    SET
        "displayName" = EXCLUDED."displayName",
        "updatedAt" = now();

    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();
