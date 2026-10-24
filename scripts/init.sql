-- Zequel Database Schema - Complete Intelligent Setup
-- This script creates/updates all tables with required columns
-- Safe to run multiple times - won't delete existing data

-- 1. Profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  display_name TEXT,
  role TEXT DEFAULT 'user',
  suspended BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing columns to profiles
DO $$ BEGIN
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS suspended BOOLEAN DEFAULT FALSE;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 2. Preferences table
CREATE TABLE IF NOT EXISTS public.preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  theme TEXT DEFAULT 'dark',
  language TEXT DEFAULT 'en',
  default_output_format TEXT DEFAULT 'markdown',
  auto_citation BOOLEAN DEFAULT TRUE,
  -- Personalization / memory settings
  reference_saved_memories BOOLEAN DEFAULT TRUE,
  reference_chat_history BOOLEAN DEFAULT TRUE,
  nickname TEXT,
  occupation TEXT,
  about_you TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing personalization columns to preferences (safe for existing installs)
DO $$ BEGIN
  ALTER TABLE public.preferences ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.preferences ADD COLUMN IF NOT EXISTS reference_saved_memories BOOLEAN DEFAULT TRUE;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.preferences ADD COLUMN IF NOT EXISTS reference_chat_history BOOLEAN DEFAULT TRUE;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.preferences ADD COLUMN IF NOT EXISTS nickname TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.preferences ADD COLUMN IF NOT EXISTS occupation TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.preferences ADD COLUMN IF NOT EXISTS about_you TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 3. Documents table
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  extracted_text TEXT,
  page_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'processing',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DO $$ BEGIN
  ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS extracted_text TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 4. Conversations table
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing document_id column to conversations
DO $$ BEGIN
  ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 5. Messages table
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  -- Alternative responses produced by "regenerate", stored as an array of
  -- { id, content, created_at } objects. JSONB (not TEXT[]) so the full
  -- version objects survive a round-trip and the version arrows persist
  -- after a reload.
  versions JSONB DEFAULT '[]'::jsonb,
  active_version_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing columns to messages
DO $$ BEGIN
  ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS versions JSONB DEFAULT '[]'::jsonb;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS active_version_index INTEGER DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Migration: older installs stored `versions` as TEXT[] and used a
-- mixed-case `activeVersionIndex` column (which Postgres folds to
-- `activeversionindex`). Normalize both so the app's snake_case JSONB
-- contract holds.
DO $$ BEGIN
  ALTER TABLE public.messages ALTER COLUMN versions TYPE JSONB USING
    CASE
      WHEN versions IS NULL THEN '[]'::jsonb
      ELSE to_jsonb(versions)
    END;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'activeversionindex'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'active_version_index'
  ) THEN
    ALTER TABLE public.messages RENAME COLUMN activeversionindex TO active_version_index;
  END IF;
END $$;

-- 6. OTP Codes table
CREATE TABLE IF NOT EXISTS public.otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('signup', 'reset_password', 'change_password', 'delete_account')),
  used BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_otp_codes_unique_unused ON public.otp_codes(email, code, purpose) WHERE used = FALSE;

-- Migration: allow the 'delete_account' purpose for existing installs whose
-- CHECK constraint predates account deletion. Drop the old constraint and
-- recreate it with the expanded allow-list.
DO $$
DECLARE
  con_name TEXT;
BEGIN
  SELECT conname INTO con_name
  FROM pg_constraint
  WHERE conrelid = 'public.otp_codes'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%purpose%';
  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.otp_codes DROP CONSTRAINT %I', con_name);
  END IF;
  ALTER TABLE public.otp_codes
    ADD CONSTRAINT otp_codes_purpose_check
    CHECK (purpose IN ('signup', 'reset_password', 'change_password', 'delete_account'));
EXCEPTION WHEN others THEN NULL;
END $$;

-- 7. Queries table (Research mode history)
-- Columns match what /api/query writes and the research panel reads.
CREATE TABLE IF NOT EXISTS public.queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  query_text TEXT NOT NULL,
  output_format TEXT NOT NULL DEFAULT 'summarize',
  document_ids JSONB DEFAULT '[]'::jsonb,
  result JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Migrate legacy installs that used the old (title/query/result/status) shape.
DO $$ BEGIN
  ALTER TABLE public.queries ADD COLUMN IF NOT EXISTS query_text TEXT;
  ALTER TABLE public.queries ADD COLUMN IF NOT EXISTS output_format TEXT DEFAULT 'summarize';
  ALTER TABLE public.queries ADD COLUMN IF NOT EXISTS document_ids JSONB DEFAULT '[]'::jsonb;
  -- Drop legacy NOT NULL constraints that would block new inserts
  BEGIN ALTER TABLE public.queries ALTER COLUMN title DROP NOT NULL; EXCEPTION WHEN undefined_column THEN NULL; END;
  BEGIN ALTER TABLE public.queries ALTER COLUMN query DROP NOT NULL; EXCEPTION WHEN undefined_column THEN NULL; END;
END $$;

-- Ensure `result` is JSONB (legacy schema used TEXT).
DO $$ BEGIN
  ALTER TABLE public.queries ALTER COLUMN result TYPE JSONB USING result::jsonb;
EXCEPTION WHEN others THEN NULL;
END $$;

-- 8. AI Usage Logs table
CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER,
  output_tokens INTEGER,
  status TEXT DEFAULT 'success',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Subscriptions table
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  plan TEXT DEFAULT 'free',
  status TEXT DEFAULT 'active',
  request_limit INTEGER DEFAULT 20,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Migration: ensure subscriptions has every column the app writes. Older installs
-- created this table before `status`, `request_limit`, and `expires_at` existed,
-- and the `CREATE TABLE IF NOT EXISTS` above will NOT add them to an existing
-- table. Without this, admin and self-serve plan changes fail with errors like
-- "Could not find the 'expires_at' column of 'subscriptions' in the schema cache".
DO $$ BEGIN
  ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free';
  ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
  ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS request_limit INTEGER DEFAULT 20;
  ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;
  ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
END $$;

-- 9b. Plan configuration table — editable pricing + feature lists for each plan.
-- These power the platform's subscription page and will be the source of truth
-- when a payment provider is integrated. The admin Subscriptions page edits them.
-- (The website's marketing pricing is managed separately via the CMS.)
CREATE TABLE IF NOT EXISTS public.plan_configs (
  plan TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  description TEXT DEFAULT '',
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  popular BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Seed default plan configs (left untouched if rows already exist).
INSERT INTO public.plan_configs (plan, name, price, description, features, popular, sort_order) VALUES
  ('free', 'Free', 0, 'Perfect for getting started',
    '["20 AI requests per day","3 document uploads","Basic study mode","Standard response speed","Community support","Limited workspace history"]'::jsonb,
    FALSE, 0),
  ('premium_lite', 'Premium Lite', 2.99, 'For regular researchers',
    '["200 AI requests per day","30 document uploads","Advanced study mode","Research mode access","Multi-document analysis","Priority response speed","Email support","Extended file size (50MB)","Citation export","Full workspace history","Advanced research tools"]'::jsonb,
    TRUE, 1),
  ('premium_pro', 'Premium Pro', 5.99, 'For power users',
    '["1,000 AI requests per day","100 document uploads","Advanced+ study mode","Research mode access","Multi-document analysis","Highest priority speed","Priority support","Extended file size (100MB)","Citation export","Full workspace history","Advanced research tools","Early access features"]'::jsonb,
    FALSE, 2)
ON CONFLICT (plan) DO NOTHING;

-- 10. Rate limit violations table
CREATE TABLE IF NOT EXISTS public.rate_limit_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  violation_type TEXT NOT NULL,
  attempted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11. System settings table (KEY/VALUE store)
-- IMPORTANT: The application (lib/settings/system-settings.ts and
-- app/api/admin/settings/route.ts) reads/writes this table as key/value rows
-- using .select('key, value') and .upsert({ key, value }). The schema MUST be
-- a key/value table, NOT a wide single-row table, or every settings read fails
-- and the app silently falls back to defaults ("System settings not found").
CREATE TABLE IF NOT EXISTS public.system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Migration: if an older WIDE system_settings table exists (with an `id`
-- column instead of `key`), drop it so the key/value schema can be created.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'system_settings' AND column_name = 'id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'system_settings' AND column_name = 'key'
  ) THEN
    DROP TABLE public.system_settings CASCADE;
    CREATE TABLE public.system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
    );
  END IF;
END $$;

-- Seed default settings as key/value rows (matches DEFAULT_SETTINGS in
-- lib/settings/system-settings.ts). Existing keys are left untouched.
INSERT INTO public.system_settings (key, value) VALUES
  ('ai_enabled', 'true'),
  ('free_daily_limit', '20'),
  ('premium_lite_daily_limit', '200'),
  ('premium_pro_daily_limit', '1000'),
  ('max_file_uploads_free', '3'),
  ('max_file_uploads_premium_lite', '30'),
  ('max_file_uploads_premium_pro', '100'),
  ('max_tokens_per_request', '16384'),
  ('default_model', 'openai/gpt-5-nano'),
  ('file_uploads_enabled', 'true'),
  ('max_file_size_mb', '10'),
  ('maintenance_mode', 'false'),
  ('max_requests_per_minute', '15'),
  ('max_requests_per_hour', '100'),
  ('burst_limit_threshold', '5'),
  ('burst_cooldown_seconds', '30'),
  ('response_style', 'detailed')
ON CONFLICT (key) DO NOTHING;

-- Migration: normalize subscription plan values and migrate legacy tiers.
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscriptions' AND column_name = 'plan') THEN
    -- Normalize any space/dash/case variants to the canonical underscore form
    -- the application expects (e.g. 'premium pro' -> 'premium_pro').
    UPDATE public.subscriptions SET plan = 'premium_pro'
      WHERE lower(regexp_replace(plan, '[\s-]+', '_', 'g')) = 'premium_pro';
    UPDATE public.subscriptions SET plan = 'premium_lite'
      WHERE lower(regexp_replace(plan, '[\s-]+', '_', 'g')) = 'premium_lite';

    -- Migrate old single-tier names
    UPDATE public.subscriptions SET plan = 'premium_lite' WHERE plan = 'premium';
    UPDATE public.subscriptions SET plan = 'premium_pro' WHERE plan = 'enterprise';
  END IF;
  
  -- Update request limits only if the column exists
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscriptions' AND column_name = 'request_limit') THEN
    UPDATE public.subscriptions SET request_limit = 20 WHERE plan = 'free' AND request_limit = 50;
    UPDATE public.subscriptions SET request_limit = 200 WHERE plan = 'premium_lite';
    UPDATE public.subscriptions SET request_limit = 1000 WHERE plan = 'premium_pro';
  END IF;
END $$;

-- 12. Admin audit logs table
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 13. User Sessions table (for device/session tracking with 3-device limit)
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_token TEXT NOT NULL UNIQUE,
  device_name TEXT,
  device_type TEXT, -- 'desktop', 'mobile', 'tablet'
  browser TEXT,
  os TEXT,
  ip_address INET,
  location TEXT,
  is_current BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  revoked_at TIMESTAMP WITH TIME ZONE,
  revoked_reason TEXT
);

-- 14. Memories table (personalization — details Zequel remembers about a user)
CREATE TABLE IF NOT EXISTS public.memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  source TEXT DEFAULT 'ai', -- 'ai' (auto-extracted) or 'user'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 15. Bug reports table (submitted by users from Settings > Help, reviewed in the admin dashboard)
CREATE TABLE IF NOT EXISTS public.bug_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  user_name TEXT,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  page_url TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON public.documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON public.documents(status);
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON public.conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_otp_codes_email ON public.otp_codes(email);
CREATE INDEX IF NOT EXISTS idx_otp_codes_expires_at ON public.otp_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user_id ON public.ai_usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_rate_limit_violations_user_id ON public.rate_limit_violations(user_id);
CREATE INDEX IF NOT EXISTS idx_preferences_user_id ON public.preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_queries_user_id ON public.queries(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin_id ON public.admin_audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at ON public.admin_audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON public.user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON public.user_sessions(user_id, revoked_at) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_memories_user_id ON public.memories(user_id);
CREATE INDEX IF NOT EXISTS idx_memories_created_at ON public.memories(created_at);
CREATE INDEX IF NOT EXISTS idx_bug_reports_user_id ON public.bug_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_bug_reports_status ON public.bug_reports(status);
CREATE INDEX IF NOT EXISTS idx_bug_reports_created_at ON public.bug_reports(created_at);

-- Enable Row Level Security on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limit_violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- RLS Policies for preferences
DROP POLICY IF EXISTS "preferences_select_own" ON public.preferences;
DROP POLICY IF EXISTS "preferences_insert_own" ON public.preferences;
DROP POLICY IF EXISTS "preferences_update_own" ON public.preferences;
CREATE POLICY "preferences_select_own" ON public.preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "preferences_insert_own" ON public.preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "preferences_update_own" ON public.preferences FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for documents
DROP POLICY IF EXISTS "documents_select_own" ON public.documents;
DROP POLICY IF EXISTS "documents_insert_own" ON public.documents;
DROP POLICY IF EXISTS "documents_update_own" ON public.documents;
DROP POLICY IF EXISTS "documents_delete_own" ON public.documents;
CREATE POLICY "documents_select_own" ON public.documents FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "documents_insert_own" ON public.documents FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "documents_update_own" ON public.documents FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "documents_delete_own" ON public.documents FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for conversations
DROP POLICY IF EXISTS "conversations_select_own" ON public.conversations;
DROP POLICY IF EXISTS "conversations_insert_own" ON public.conversations;
DROP POLICY IF EXISTS "conversations_update_own" ON public.conversations;
DROP POLICY IF EXISTS "conversations_delete_own" ON public.conversations;
CREATE POLICY "conversations_select_own" ON public.conversations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "conversations_insert_own" ON public.conversations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "conversations_update_own" ON public.conversations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "conversations_delete_own" ON public.conversations FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for messages
DROP POLICY IF EXISTS "messages_select_own_conversation" ON public.messages;
DROP POLICY IF EXISTS "messages_insert_own_conversation" ON public.messages;
DROP POLICY IF EXISTS "messages_update_own_conversation" ON public.messages;
DROP POLICY IF EXISTS "messages_delete_own_conversation" ON public.messages;
CREATE POLICY "messages_select_own_conversation" ON public.messages FOR SELECT 
  USING (conversation_id IN (SELECT id FROM public.conversations WHERE user_id = auth.uid()));
CREATE POLICY "messages_insert_own_conversation" ON public.messages FOR INSERT 
  WITH CHECK (conversation_id IN (SELECT id FROM public.conversations WHERE user_id = auth.uid()));
CREATE POLICY "messages_update_own_conversation" ON public.messages FOR UPDATE 
  USING (conversation_id IN (SELECT id FROM public.conversations WHERE user_id = auth.uid()));
CREATE POLICY "messages_delete_own_conversation" ON public.messages FOR DELETE 
  USING (conversation_id IN (SELECT id FROM public.conversations WHERE user_id = auth.uid()));

-- RLS Policies for queries
DROP POLICY IF EXISTS "queries_select_own" ON public.queries;
DROP POLICY IF EXISTS "queries_insert_own" ON public.queries;
DROP POLICY IF EXISTS "queries_update_own" ON public.queries;
DROP POLICY IF EXISTS "queries_delete_own" ON public.queries;
CREATE POLICY "queries_select_own" ON public.queries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "queries_insert_own" ON public.queries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "queries_update_own" ON public.queries FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "queries_delete_own" ON public.queries FOR DELETE USING (auth.uid() = user_id);

-- OTP codes: no client policies. Only server routes (service role) may access them.
DROP POLICY IF EXISTS "otp_codes_anon_insert" ON public.otp_codes;
DROP POLICY IF EXISTS "otp_codes_anon_select" ON public.otp_codes;
DROP POLICY IF EXISTS "otp_codes_anon_update" ON public.otp_codes;


-- RLS Policies for AI usage logs
DROP POLICY IF EXISTS "ai_usage_logs_select_own" ON public.ai_usage_logs;
CREATE POLICY "ai_usage_logs_select_own" ON public.ai_usage_logs FOR SELECT USING (auth.uid() = user_id);

-- RLS Policies for rate limit violations
DROP POLICY IF EXISTS "rate_limit_violations_select_own" ON public.rate_limit_violations;
CREATE POLICY "rate_limit_violations_select_own" ON public.rate_limit_violations FOR SELECT USING (auth.uid() = user_id);

-- RLS Policies for subscriptions
DROP POLICY IF EXISTS "subscriptions_select_own" ON public.subscriptions;
DROP POLICY IF EXISTS "subscriptions_insert_own" ON public.subscriptions;
CREATE POLICY "subscriptions_select_own" ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);

-- RLS Policies for plan_configs (publicly readable so the platform & website
-- can render current pricing; writes happen only through the admin service client).
ALTER TABLE public.plan_configs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "plan_configs_public_select" ON public.plan_configs;
CREATE POLICY "plan_configs_public_select" ON public.plan_configs FOR SELECT USING (true);

-- RLS Policies for user_sessions
DROP POLICY IF EXISTS "user_sessions_select_own" ON public.user_sessions;
DROP POLICY IF EXISTS "user_sessions_update_own" ON public.user_sessions;
CREATE POLICY "user_sessions_select_own" ON public.user_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_sessions_update_own" ON public.user_sessions FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- RLS Policies for memories
DROP POLICY IF EXISTS "memories_select_own" ON public.memories;
DROP POLICY IF EXISTS "memories_insert_own" ON public.memories;
DROP POLICY IF EXISTS "memories_update_own" ON public.memories;
DROP POLICY IF EXISTS "memories_delete_own" ON public.memories;
CREATE POLICY "memories_select_own" ON public.memories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "memories_insert_own" ON public.memories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "memories_update_own" ON public.memories FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "memories_delete_own" ON public.memories FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for bug_reports (users submit and read their own; admins read all via service client)
DROP POLICY IF EXISTS "bug_reports_select_own" ON public.bug_reports;
DROP POLICY IF EXISTS "bug_reports_insert_own" ON public.bug_reports;
CREATE POLICY "bug_reports_select_own" ON public.bug_reports FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "bug_reports_insert_own" ON public.bug_reports FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Trigger function to create profile on new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id) VALUES (new.id) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.preferences (user_id) VALUES (new.id) ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.subscriptions (user_id) VALUES (new.id) ON CONFLICT (user_id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- NOTE: run 002-security-and-documents.sql after this file for privilege
-- protection, OTP brute-force limits, and document processing columns.

-- Force PostgREST (Supabase's API layer) to reload its cached schema.
-- Newly added columns like subscriptions.expires_at exist in Postgres immediately,
-- but the API keeps reporting "Could not find the 'expires_at' column ... in the
-- schema cache" until PostgREST is told to reload. This makes reruns self-healing.
NOTIFY pgrst, 'reload schema';

-- Storage bucket setup (run these separately in Supabase Dashboard > Storage)
-- Create buckets: 'documents' and 'avatars'
-- Then run these policies in SQL Editor:

-- Documents bucket policies
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "documents_bucket_select" ON storage.objects;
DROP POLICY IF EXISTS "documents_bucket_insert" ON storage.objects;
DROP POLICY IF EXISTS "documents_bucket_update" ON storage.objects;
DROP POLICY IF EXISTS "documents_bucket_delete" ON storage.objects;

CREATE POLICY "documents_bucket_select" ON storage.objects FOR SELECT 
  USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "documents_bucket_insert" ON storage.objects FOR INSERT 
  WITH CHECK (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "documents_bucket_update" ON storage.objects FOR UPDATE 
  USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "documents_bucket_delete" ON storage.objects FOR DELETE 
  USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Avatars bucket policies
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "avatars_bucket_select" ON storage.objects;
DROP POLICY IF EXISTS "avatars_bucket_insert" ON storage.objects;
DROP POLICY IF EXISTS "avatars_bucket_update" ON storage.objects;
DROP POLICY IF EXISTS "avatars_bucket_delete" ON storage.objects;

CREATE POLICY "avatars_bucket_select" ON storage.objects FOR SELECT 
  USING (bucket_id = 'avatars');

CREATE POLICY "avatars_bucket_insert" ON storage.objects FOR INSERT 
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "avatars_bucket_update" ON storage.objects FOR UPDATE 
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "avatars_bucket_delete" ON storage.objects FOR DELETE 
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
