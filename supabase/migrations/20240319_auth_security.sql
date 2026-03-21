-- 1. Create table for Auth Rate Limiting (Anti-Brute Force)
CREATE TABLE IF NOT EXISTS public.auth_rate_limits (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    identifier TEXT NOT NULL, -- Email or IP Address
    attempt_type TEXT NOT NULL, -- 'login' or 'signup'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast counts over time windows
CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_identifier_time 
ON public.auth_rate_limits (identifier, created_at);

-- 2. New Account Sandboxing (Anti-Abuse) Function
-- This function can be used within Row Level Security (RLS) policies 
-- on tables that handle high-value operations (e.g. invites, bulk imports).
CREATE OR REPLACE FUNCTION public.is_account_sandbox_cleared()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 
        FROM auth.users 
        WHERE id = auth.uid() 
        -- Account must be older than 24 hours to clear the sandbox
        AND created_at < NOW() - INTERVAL '24 hours'
    );
$$;

-- 5. RPC Data function to detect Google OAuth Collisions without returning full payloads
CREATE OR REPLACE FUNCTION public.check_social_collision(check_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER
SET search_path = public, auth
AS $$
    SELECT EXISTS (
        SELECT 1 
        FROM auth.users 
        WHERE email = check_email 
        AND encrypted_password IS NULL 
        AND raw_app_meta_data->'providers' @> '["google"]'::jsonb
    );
$$;

-- Example of how to use it in an RLS Policy:
-- CREATE POLICY "Allow high-cost actions only for mature accounts"
-- ON public.bulk_imports
-- FOR INSERT
-- TO authenticated
-- USING (public.is_account_sandbox_cleared());
