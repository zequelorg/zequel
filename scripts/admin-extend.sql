-- Zequel Admin Dashboard Extension Migration
-- Adds: safety_events + full Website CMS content tables.
-- Safe to run multiple times (IF NOT EXISTS / ON CONFLICT DO NOTHING).
-- profiles.role and profiles.suspended already exist in scripts/init.sql.

-- ===========================================================================
-- 1. Safety events (AI safety / moderation center)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.safety_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  category TEXT NOT NULL DEFAULT 'abuse' CHECK (category IN ('harmful','pii','jailbreak','spam','abuse')),
  severity TEXT NOT NULL DEFAULT 'low' CHECK (severity IN ('low','medium','high','critical')),
  action TEXT NOT NULL DEFAULT 'flagged' CHECK (action IN ('flagged','blocked','reviewed','dismissed')),
  detail TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_safety_events_created_at ON public.safety_events(created_at);
CREATE INDEX IF NOT EXISTS idx_safety_events_severity ON public.safety_events(severity);
CREATE INDEX IF NOT EXISTS idx_safety_events_action ON public.safety_events(action);

-- ===========================================================================
-- 1b. Conversation moderation status (admin archive / flag)
-- ===========================================================================
-- Adds a moderation status to conversations so the admin Conversations page
-- can archive or flag a thread. Defaults to 'active' for existing rows.
DO $$ BEGIN
  ALTER TABLE public.conversations
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','archived','flagged'));
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS idx_conversations_status ON public.conversations(status);

-- ===========================================================================
-- 2. Website CMS content tables
-- ===========================================================================

-- Pages
CREATE TABLE IF NOT EXISTS public.cms_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('published','draft','scheduled','archived')),
  seo_title TEXT,
  seo_description TEXT,
  sections INTEGER DEFAULT 0,
  updated_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Hero sections
CREATE TABLE IF NOT EXISTS public.cms_hero_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page TEXT NOT NULL,
  eyebrow TEXT,
  headline TEXT NOT NULL,
  subhead TEXT,
  primary_cta_label TEXT,
  primary_cta_href TEXT,
  secondary_cta_label TEXT,
  secondary_cta_href TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('published','draft','scheduled','archived')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Feature items
CREATE TABLE IF NOT EXISTS public.cms_feature_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  group_name TEXT,
  sort_order INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('published','draft','scheduled','archived')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Pricing plans
CREATE TABLE IF NOT EXISTS public.cms_pricing_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  price_monthly NUMERIC DEFAULT 0,
  price_yearly NUMERIC DEFAULT 0,
  description TEXT,
  features JSONB DEFAULT '[]'::jsonb,
  highlighted BOOLEAN DEFAULT FALSE,
  cta_label TEXT,
  sort_order INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('published','draft','scheduled','archived')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Documentation articles
CREATE TABLE IF NOT EXISTS public.cms_doc_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  category TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('published','draft','scheduled','archived')),
  reading_minutes INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  updated_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Blog posts
CREATE TABLE IF NOT EXISTS public.cms_blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  excerpt TEXT,
  author TEXT,
  tags JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('published','draft','scheduled','archived')),
  published_at TIMESTAMP WITH TIME ZONE,
  views INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Changelog entries
CREATE TABLE IF NOT EXISTS public.cms_changelog_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'feature' CHECK (type IN ('feature','improvement','fix','security')),
  body TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('published','draft','scheduled','archived')),
  released_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- FAQ items
CREATE TABLE IF NOT EXISTS public.cms_faq_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  answer TEXT,
  category TEXT,
  sort_order INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('published','draft','scheduled','archived')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Contact messages (inbound)
CREATE TABLE IF NOT EXISTS public.cms_contact_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','read','replied','archived')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Feature requests (inbound)
CREATE TABLE IF NOT EXISTS public.cms_feature_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  requester TEXT,
  email TEXT,
  votes INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','planned','in_progress','shipped','declined')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- CMS bug reports (public-site reported bugs; distinct from in-app bug_reports)
CREATE TABLE IF NOT EXISTS public.cms_bug_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  reporter TEXT,
  email TEXT,
  severity TEXT NOT NULL DEFAULT 'low' CHECK (severity IN ('low','medium','high','critical')),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','triaged','in_progress','resolved','wont_fix')),
  url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Media assets
CREATE TABLE IF NOT EXISTS public.cms_media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'image' CHECK (type IN ('image','video','document','icon')),
  url TEXT NOT NULL,
  size_kb INTEGER DEFAULT 0,
  width INTEGER,
  height INTEGER,
  uploaded_by TEXT,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Stats (home page numbers band + about page values band; grouped by group_name)
CREATE TABLE IF NOT EXISTS public.cms_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  value TEXT NOT NULL,
  label TEXT NOT NULL,
  group_name TEXT NOT NULL DEFAULT 'home',
  sort_order INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('published','draft','scheduled','archived')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Steps (home page "how it works" workflow)
CREATE TABLE IF NOT EXISTS public.cms_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  step TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  sort_order INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('published','draft','scheduled','archived')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Testimonials (home page customer quotes)
CREATE TABLE IF NOT EXISTS public.cms_testimonials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT,
  sort_order INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('published','draft','scheduled','archived')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Principles (about page "what we build by" cards)
CREATE TABLE IF NOT EXISTS public.cms_principles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT,
  sort_order INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('published','draft','scheduled','archived')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Feature pillars (features page large alternating sections; points stored as JSONB)
CREATE TABLE IF NOT EXISTS public.cms_pillars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  points JSONB DEFAULT '[]'::jsonb,
  image TEXT,
  url TEXT,
  sort_order INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('published','draft','scheduled','archived')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- About story (singleton: opening paragraphs on the about page, blank-line separated)
CREATE TABLE IF NOT EXISTS public.cms_about_story (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  body TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('published','draft','scheduled','archived')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for ordering / filtering
CREATE INDEX IF NOT EXISTS idx_cms_feature_items_order ON public.cms_feature_items(sort_order);
CREATE INDEX IF NOT EXISTS idx_cms_pricing_plans_order ON public.cms_pricing_plans(sort_order);
CREATE INDEX IF NOT EXISTS idx_cms_doc_articles_order ON public.cms_doc_articles(sort_order);
CREATE INDEX IF NOT EXISTS idx_cms_faq_items_order ON public.cms_faq_items(sort_order);
CREATE INDEX IF NOT EXISTS idx_cms_blog_posts_status ON public.cms_blog_posts(status);
CREATE INDEX IF NOT EXISTS idx_cms_stats_order ON public.cms_stats(sort_order);
CREATE INDEX IF NOT EXISTS idx_cms_stats_group ON public.cms_stats(group_name);
CREATE INDEX IF NOT EXISTS idx_cms_steps_order ON public.cms_steps(sort_order);
CREATE INDEX IF NOT EXISTS idx_cms_testimonials_order ON public.cms_testimonials(sort_order);
CREATE INDEX IF NOT EXISTS idx_cms_principles_order ON public.cms_principles(sort_order);
CREATE INDEX IF NOT EXISTS idx_cms_pillars_order ON public.cms_pillars(sort_order);

-- ===========================================================================
-- 3. Row Level Security
--    Admin routes use the service-role client (bypasses RLS). For published
--    content we additionally allow anonymous SELECT so the public website can
--    read it directly. Writes are restricted to the service role only.
-- ===========================================================================
ALTER TABLE public.safety_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_hero_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_feature_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_pricing_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_doc_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_changelog_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_faq_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_contact_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_feature_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_bug_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_testimonials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_principles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_pillars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_about_story ENABLE ROW LEVEL SECURITY;

-- Public website may read published content of presentational CMS tables.
DROP POLICY IF EXISTS "cms_pages_public_read" ON public.cms_pages;
CREATE POLICY "cms_pages_public_read" ON public.cms_pages FOR SELECT USING (status = 'published');
DROP POLICY IF EXISTS "cms_hero_public_read" ON public.cms_hero_sections;
CREATE POLICY "cms_hero_public_read" ON public.cms_hero_sections FOR SELECT USING (status = 'published');
DROP POLICY IF EXISTS "cms_feature_public_read" ON public.cms_feature_items;
CREATE POLICY "cms_feature_public_read" ON public.cms_feature_items FOR SELECT USING (status = 'published');
DROP POLICY IF EXISTS "cms_pricing_public_read" ON public.cms_pricing_plans;
CREATE POLICY "cms_pricing_public_read" ON public.cms_pricing_plans FOR SELECT USING (status = 'published');
DROP POLICY IF EXISTS "cms_doc_public_read" ON public.cms_doc_articles;
CREATE POLICY "cms_doc_public_read" ON public.cms_doc_articles FOR SELECT USING (status = 'published');
DROP POLICY IF EXISTS "cms_blog_public_read" ON public.cms_blog_posts;
CREATE POLICY "cms_blog_public_read" ON public.cms_blog_posts FOR SELECT USING (status = 'published');
DROP POLICY IF EXISTS "cms_changelog_public_read" ON public.cms_changelog_entries;
CREATE POLICY "cms_changelog_public_read" ON public.cms_changelog_entries FOR SELECT USING (status = 'published');
DROP POLICY IF EXISTS "cms_faq_public_read" ON public.cms_faq_items;
CREATE POLICY "cms_faq_public_read" ON public.cms_faq_items FOR SELECT USING (status = 'published');
DROP POLICY IF EXISTS "cms_media_public_read" ON public.cms_media_assets;
CREATE POLICY "cms_media_public_read" ON public.cms_media_assets FOR SELECT USING (true);
DROP POLICY IF EXISTS "cms_stats_public_read" ON public.cms_stats;
CREATE POLICY "cms_stats_public_read" ON public.cms_stats FOR SELECT USING (status = 'published');
DROP POLICY IF EXISTS "cms_steps_public_read" ON public.cms_steps;
CREATE POLICY "cms_steps_public_read" ON public.cms_steps FOR SELECT USING (status = 'published');
DROP POLICY IF EXISTS "cms_testimonials_public_read" ON public.cms_testimonials;
CREATE POLICY "cms_testimonials_public_read" ON public.cms_testimonials FOR SELECT USING (status = 'published');
DROP POLICY IF EXISTS "cms_principles_public_read" ON public.cms_principles;
CREATE POLICY "cms_principles_public_read" ON public.cms_principles FOR SELECT USING (status = 'published');
DROP POLICY IF EXISTS "cms_pillars_public_read" ON public.cms_pillars;
CREATE POLICY "cms_pillars_public_read" ON public.cms_pillars FOR SELECT USING (status = 'published');
DROP POLICY IF EXISTS "cms_about_story_public_read" ON public.cms_about_story;
CREATE POLICY "cms_about_story_public_read" ON public.cms_about_story FOR SELECT USING (status = 'published');

-- Anonymous visitors may submit inbound messages from the public website.
DROP POLICY IF EXISTS "cms_contact_anon_insert" ON public.cms_contact_messages;
CREATE POLICY "cms_contact_anon_insert" ON public.cms_contact_messages FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "cms_feature_req_anon_insert" ON public.cms_feature_requests;
CREATE POLICY "cms_feature_req_anon_insert" ON public.cms_feature_requests FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "cms_bug_anon_insert" ON public.cms_bug_reports;
CREATE POLICY "cms_bug_anon_insert" ON public.cms_bug_reports FOR INSERT WITH CHECK (true);
