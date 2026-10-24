-- ===========================================================================
-- Zequel Support Center
--
-- Unified ticketing layer for the admin Support Center. Every inbound
-- submission (support email, info request, in-app bug report, website contact
-- form) becomes a `support_tickets` row, and every user/admin/system/email/note
-- entry becomes a `support_messages` row attached to that ticket.
--
-- Admin access is via the service-role client (bypasses RLS); end users may
-- read/insert their own tickets and messages. Safe to run multiple times.
--
-- INBOUND EMAIL (email -> Support Center)
-- ---------------------------------------
-- Emails sent to your support address become tickets via the Resend Inbound
-- webhook at: POST /api/webhooks/inbound-email (admin app). Required env vars:
--   RESEND_API_KEY          - send admin replies + fetch inbound bodies
--   RESEND_WEBHOOK_SECRET   - verify the Resend inbound webhook signature
--   SUPPORT_INBOUND_ADDRESS - reply-to address (defaults to support@zequel.xyz)
-- In Resend: enable receiving on your domain and point the inbound route at
-- the webhook URL. Replies thread onto a ticket via the "[ZQ-####]" subject ref.
-- ===========================================================================

-- --- Tickets ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Human-readable reference shown in the UI, e.g. "ZQ-4821".
  ref TEXT UNIQUE NOT NULL DEFAULT ('ZQ-' || LPAD((FLOOR(RANDOM() * 9000) + 1000)::TEXT, 4, '0')),
  -- Owning user. Nullable: website contact forms / info requests may come from
  -- people without an account.
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT NOT NULL,
  user_name TEXT,
  subject TEXT NOT NULL,
  preview TEXT,
  source TEXT NOT NULL DEFAULT 'support_email'
    CHECK (source IN ('support_email', 'information_request', 'bug_report', 'contact_form')),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'waiting_for_user', 'resolved', 'closed')),
  -- Assigned admin (references profiles.id). Null = unassigned.
  assigned_admin_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  -- Bug report context captured automatically from the platform.
  bug_browser TEXT,
  bug_device TEXT,
  bug_os TEXT,
  bug_page_url TEXT,
  bug_screenshot TEXT,
  bug_description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- --- Messages / timeline ---------------------------------------------------
CREATE TABLE IF NOT EXISTS public.support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  -- kind: who/what produced this entry.
  --   user   -> message from the end user
  --   admin  -> reply from staff (emailed to the user)
  --   email  -> outbound email composed by staff
  --   note   -> internal note (staff only, never sent)
  --   system -> automated event (created, assigned, resolved, ...)
  kind TEXT NOT NULL DEFAULT 'user'
    CHECK (kind IN ('user', 'admin', 'email', 'note', 'system')),
  author TEXT NOT NULL DEFAULT 'System',
  -- For admin/email/note entries, the staff member who created it.
  author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  -- Short machine label for system events, e.g. "Ticket Created".
  event TEXT,
  -- Email metadata for email entries.
  email_from TEXT,
  email_to TEXT,
  email_subject TEXT,
  -- Attachments stored as JSON: [{ id, name, size, kind }]
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- --- Indexes ---------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_source ON public.support_tickets(source);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned ON public.support_tickets(assigned_admin_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON public.support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_last_activity ON public.support_tickets(last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_messages_ticket_id ON public.support_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_support_messages_created_at ON public.support_messages(created_at);

-- --- Keep updated_at / last_activity_at fresh ------------------------------
CREATE OR REPLACE FUNCTION public.support_tickets_touch()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_support_tickets_touch ON public.support_tickets;
CREATE TRIGGER trg_support_tickets_touch
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.support_tickets_touch();

-- When a new message lands, bump the parent ticket's activity timestamps.
-- Internal notes update updated_at but not last_activity_at (no user-facing
-- change), matching the UI's behaviour.
CREATE OR REPLACE FUNCTION public.support_messages_bump_ticket()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.support_tickets
  SET updated_at = NOW(),
      last_activity_at = CASE WHEN NEW.kind = 'note' THEN last_activity_at ELSE NOW() END
  WHERE id = NEW.ticket_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_support_messages_bump_ticket ON public.support_messages;
CREATE TRIGGER trg_support_messages_bump_ticket
  AFTER INSERT ON public.support_messages
  FOR EACH ROW EXECUTE FUNCTION public.support_messages_bump_ticket();

-- --- Row Level Security ----------------------------------------------------
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- Users can read and create their own tickets. Admins use the service client
-- (which bypasses RLS) so no admin-specific policy is required.
DROP POLICY IF EXISTS "support_tickets_select_own" ON public.support_tickets;
CREATE POLICY "support_tickets_select_own" ON public.support_tickets
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "support_tickets_insert_own" ON public.support_tickets;
CREATE POLICY "support_tickets_insert_own" ON public.support_tickets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can read non-internal messages on their own tickets, and add replies.
DROP POLICY IF EXISTS "support_messages_select_own" ON public.support_messages;
CREATE POLICY "support_messages_select_own" ON public.support_messages
  FOR SELECT USING (
    kind <> 'note'
    AND EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = support_messages.ticket_id AND t.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "support_messages_insert_own" ON public.support_messages;
CREATE POLICY "support_messages_insert_own" ON public.support_messages
  FOR INSERT WITH CHECK (
    kind = 'user'
    AND EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = support_messages.ticket_id AND t.user_id = auth.uid()
    )
  );
