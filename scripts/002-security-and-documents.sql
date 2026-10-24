-- Zequel migration 002: security hardening + document processing columns.
-- Safe to run multiple times. Run in the Supabase SQL editor after init.sql.

-- ---------------------------------------------------------------------------
-- 1. OTP codes: server-only access.
-- The previous policies (USING (true)) let anyone holding the public anon key
-- read every active verification code and take over any account. All OTP
-- traffic goes through API routes that use the service role, which bypasses RLS,
-- so no client policies are needed at all.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "otp_codes_anon_insert" ON public.otp_codes;
DROP POLICY IF EXISTS "otp_codes_anon_select" ON public.otp_codes;
DROP POLICY IF EXISTS "otp_codes_anon_update" ON public.otp_codes;
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.otp_codes ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_otp_codes_lookup ON public.otp_codes(email, purpose, used, created_at DESC);

-- ---------------------------------------------------------------------------
-- 2. Subscriptions: users may read but never write their own plan.
-- The insert policy allowed a user without a row to insert plan = 'premium_pro'.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "subscriptions_insert_own" ON public.subscriptions;

-- ---------------------------------------------------------------------------
-- 3. Profiles: block privilege escalation through the public update policy.
-- profiles_update_own allowed `update profiles set role = 'superadmin'`, which
-- the admin dashboard trusts. Only the service role may change role/suspended.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_profile_privileges()
RETURNS TRIGGER AS $$
DECLARE
  is_privileged BOOLEAN := coalesce(auth.role(), '') = 'service_role'
    OR current_user IN ('postgres', 'supabase_admin');
BEGIN
  IF is_privileged THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.role := 'user';
    NEW.suspended := FALSE;
  ELSE
    NEW.role := OLD.role;
    NEW.suspended := OLD.suspended;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS protect_profile_privileges ON public.profiles;
CREATE TRIGGER protect_profile_privileges
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_privileges();

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- 4. Tighten update policies so rows cannot be re-assigned to another user.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "documents_update_own" ON public.documents;
CREATE POLICY "documents_update_own" ON public.documents FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "conversations_update_own" ON public.conversations;
CREATE POLICY "conversations_update_own" ON public.conversations FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "preferences_update_own" ON public.preferences;
CREATE POLICY "preferences_update_own" ON public.preferences FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "memories_update_own" ON public.memories;
CREATE POLICY "memories_update_own" ON public.memories FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "messages_update_own_conversation" ON public.messages;
CREATE POLICY "messages_update_own_conversation" ON public.messages FOR UPDATE
  USING (conversation_id IN (SELECT id FROM public.conversations WHERE user_id = auth.uid()))
  WITH CHECK (conversation_id IN (SELECT id FROM public.conversations WHERE user_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- 5. Server-only helpers for looking up auth users by email.
-- Replaces auth.admin.listUsers(), which only returned the first page of users
-- (password reset silently failed past ~50 accounts).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auth_user_id_by_email(lookup_email TEXT)
RETURNS UUID AS $$
  SELECT id FROM auth.users WHERE lower(email) = lower(lookup_email) LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = auth, public;

CREATE OR REPLACE FUNCTION public.auth_email_exists(lookup_email TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = lower(lookup_email));
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = auth, public;

REVOKE ALL ON FUNCTION public.auth_user_id_by_email(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.auth_email_exists(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auth_user_id_by_email(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.auth_email_exists(TEXT) TO service_role;

-- ---------------------------------------------------------------------------
-- 6. Document processing: page-aware extraction, visual analysis, dedupe.
-- ---------------------------------------------------------------------------
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS content_hash TEXT;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS pages JSONB;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS visual_status TEXT DEFAULT 'pending';
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS visual_analysis TEXT;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS processing_error TEXT;
CREATE INDEX IF NOT EXISTS idx_documents_user_hash ON public.documents(user_id, content_hash);

NOTIFY pgrst, 'reload schema';
