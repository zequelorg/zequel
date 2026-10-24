import { createClient } from '@supabase/supabase-js'

/**
 * Service client for server-side operations with service role key
 * Use this for operations that bypass RLS, like OTP management and admin functions
 * 
 * WARNING: This uses the service role key and bypasses RLS policies.
 * Only use for trusted server operations, never expose to clients.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) {
    console.error('[Zequel] NEXT_PUBLIC_SUPABASE_URL is not configured')
    throw new Error('SUPABASE_URL_MISSING')
  }

  if (!serviceRoleKey) {
    console.error('[Zequel] SUPABASE_SERVICE_ROLE_KEY is not configured - required for service operations')
    throw new Error('SUPABASE_SERVICE_KEY_MISSING')
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

/**
 * Check if service client can be created (for graceful fallbacks)
 */
export function canCreateServiceClient(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
}
