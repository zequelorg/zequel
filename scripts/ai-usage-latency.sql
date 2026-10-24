-- Migration: add latency_ms to ai_usage_logs
-- -----------------------------------------------------------------------------
-- The application logs AI request latency via logAIUsage(), but the original
-- `ai_usage_logs` table never had a `latency_ms` column. Inserts that included
-- `latency_ms` were therefore rejected by Postgres, so NO usage rows were ever
-- written and the admin "AI Usage" page showed empty data.
--
-- Run this against your database, then new AI requests will be recorded.

ALTER TABLE public.ai_usage_logs
  ADD COLUMN IF NOT EXISTS latency_ms INTEGER DEFAULT 0;

-- Helpful indexes for the admin AI Usage queries (filter by user / recent first).
CREATE INDEX IF NOT EXISTS ai_usage_logs_created_at_idx
  ON public.ai_usage_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS ai_usage_logs_user_id_idx
  ON public.ai_usage_logs (user_id);
