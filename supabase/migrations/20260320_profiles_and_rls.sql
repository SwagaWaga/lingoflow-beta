-- ============================================================
-- Migration: Profiles Table, Auth Trigger, and Vault RLS
-- ============================================================

-- 1. Profiles Table
-- Stores public user metadata linked to auth.users
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE,
    role TEXT NOT NULL DEFAULT 'guest'
        CHECK (role IN ('admin', 'teacher', 'student', 'parent', 'guest')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can only read and update their own profile
CREATE POLICY "profiles_select_own" ON public.profiles
    FOR SELECT TO authenticated USING (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON public.profiles
    FOR UPDATE TO authenticated USING (auth.uid() = id);

-- ============================================================
-- 2. Auto-create profile on new user signup
-- Strips the @internal.axiom.app suffix to store clean username
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    clean_username TEXT;
BEGIN
    -- Strip the internal dummy domain, save just the username portion
    clean_username := split_part(NEW.email, '@', 1);

    INSERT INTO public.profiles (id, username, role)
    VALUES (NEW.id, clean_username, 'guest')
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$$;

-- Drop existing trigger before recreating to avoid conflicts
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 3. Vault / Vocabulary Table RLS
-- Users may only access their own word records
-- ============================================================
ALTER TABLE public.user_vocabulary ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first to avoid conflicts
DROP POLICY IF EXISTS "vocab_select_own" ON public.user_vocabulary;
DROP POLICY IF EXISTS "vocab_insert_own" ON public.user_vocabulary;
DROP POLICY IF EXISTS "vocab_update_own" ON public.user_vocabulary;
DROP POLICY IF EXISTS "vocab_delete_own" ON public.user_vocabulary;

CREATE POLICY "vocab_select_own" ON public.user_vocabulary
    FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "vocab_insert_own" ON public.user_vocabulary
    FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "vocab_update_own" ON public.user_vocabulary
    FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "vocab_delete_own" ON public.user_vocabulary
    FOR DELETE TO authenticated USING (user_id = auth.uid());
