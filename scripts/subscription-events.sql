-- Zequel Subscription History Migration
-- Adds: subscription_events — an append-only audit trail of every plan change
-- (grant / tier change / revoke / reactivate / renew / payment failure) so the
-- admin Subscriptions page can show a real, persisted history per subscriber.
-- Safe to run multiple times (IF NOT EXISTS).

-- ===========================================================================
-- subscription_events
-- ===========================================================================
-- NOTE: like the rest of this schema, user_id references auth.users(id), not
-- public.profiles. Admin routes use the service-role client (bypasses RLS).
CREATE TABLE IF NOT EXISTS public.subscription_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'tier_changed'
    CHECK (type IN ('granted','tier_changed','renewed','payment_failed','revoked','reactivated')),
  from_tier TEXT,
  to_tier TEXT,
  -- Human-readable actor label (admin name/email) plus the admin's auth id.
  actor TEXT,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_events_user_id
  ON public.subscription_events(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_events_subscription_id
  ON public.subscription_events(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_events_created_at
  ON public.subscription_events(created_at DESC);

-- ===========================================================================
-- Row Level Security
--   Service-role admin routes bypass RLS. We enable RLS with no public policy
--   so the table is locked down to the service role only.
-- ===========================================================================
ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;
