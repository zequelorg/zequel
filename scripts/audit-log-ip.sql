-- Adds IP address capture to the admin audit log.
-- The application records the originating client IP for every privileged admin
-- action so the audit trail can attribute changes to a network origin.
-- Safe to run multiple times.

ALTER TABLE public.admin_audit_logs
  ADD COLUMN IF NOT EXISTS ip_address TEXT;

-- Optional: index for filtering/searching by IP in the future.
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_ip_address
  ON public.admin_audit_logs(ip_address);
