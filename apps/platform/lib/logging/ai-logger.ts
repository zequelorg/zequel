import { createServiceClient } from '@zequel/shared/supabase/service'
import type { RequestType } from '@zequel/shared/validation/ai-schema'

interface AIUsageLog {
  user_id: string
  endpoint: RequestType
  model: string
  input_tokens?: number
  output_tokens?: number
  status: 'success' | 'error' | 'rate_limited'
  error_message?: string
  latency_ms?: number
}

export async function logAIUsage(log: AIUsageLog): Promise<void> {
  try {
    // Use the service-role client so the insert bypasses RLS. The
    // `ai_usage_logs` table only has a SELECT policy (auth.uid() = user_id) and
    // NO insert policy, so the cookie/anon client was being silently rejected —
    // which is why the admin AI Usage page showed no data.
    const supabase = createServiceClient()

    // Base row that only uses columns guaranteed to exist on the table.
    const baseRow = {
      user_id: log.user_id,
      endpoint: log.endpoint,
      model: log.model,
      input_tokens: log.input_tokens || 0,
      output_tokens: log.output_tokens || 0,
      status: log.status,
      error_message: log.error_message || null,
      created_at: new Date().toISOString(),
    }

    // Preferred insert including latency_ms (added by scripts/ai-usage-latency.sql).
    const { error } = await supabase
      .from('ai_usage_logs')
      .insert({ ...baseRow, latency_ms: log.latency_ms || 0 })

    if (error) {
      // If the latency_ms column doesn't exist yet (migration not applied),
      // Postgres returns code 42703 / PGRST204. Retry without it so usage is
      // still recorded rather than silently lost.
      const missingColumn =
        error.code === '42703' ||
        error.code === 'PGRST204' ||
        /latency_ms/i.test(error.message)

      if (missingColumn) {
        const { error: retryError } = await supabase.from('ai_usage_logs').insert(baseRow)
        if (retryError) {
          console.error('[v0] Failed to insert AI usage log (retry):', retryError.message)
        }
      } else {
        console.error('[v0] Failed to insert AI usage log:', error.message)
      }
    }
  } catch (err) {
    // Don't fail the request if logging fails - just console error
    console.error('[v0] Failed to log AI usage:', err)
  }
}

// Estimate token count (rough approximation: 1 token ≈ 4 chars)
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}
