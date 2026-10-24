import type { RequestType } from '../validation/ai-schema'

// In-memory rate limit store (use Redis in production for multi-instance)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

// Rate limits per endpoint per minute
const RATE_LIMITS: Record<RequestType, { free: number; premium_lite: number; premium_pro: number }> = {
  chat: { free: 10, premium_lite: 30, premium_pro: 100 },
  query: { free: 5, premium_lite: 20, premium_pro: 50 },
  extract: { free: 5, premium_lite: 15, premium_pro: 30 },
}

const WINDOW_MS = 60 * 1000 // 1 minute window

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetIn: number
  limit: number
}

export function checkRateLimit(
  userId: string,
  endpoint: RequestType,
  plan: 'free' | 'premium_lite' | 'premium_pro' = 'free'
): RateLimitResult {
  const key = `${userId}:${endpoint}`
  const now = Date.now()
  const limit = RATE_LIMITS[endpoint][plan]

  const current = rateLimitStore.get(key)

  // If no record or window expired, reset
  if (!current || now > current.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return { allowed: true, remaining: limit - 1, resetIn: WINDOW_MS, limit }
  }

  // Check if limit exceeded
  if (current.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetIn: current.resetAt - now,
      limit,
    }
  }

  // Increment count
  current.count++
  rateLimitStore.set(key, current)

  return {
    allowed: true,
    remaining: limit - current.count,
    resetIn: current.resetAt - now,
    limit,
  }
}

// Cleanup old entries periodically (call this in a background job or API warmup)
export function cleanupRateLimitStore() {
  const now = Date.now()
  for (const [key, value] of rateLimitStore.entries()) {
    if (now > value.resetAt) {
      rateLimitStore.delete(key)
    }
  }
}

// Clear rate limit for a user (e.g., after subscription upgrade)
export function clearRateLimit(userId: string) {
  for (const key of rateLimitStore.keys()) {
    if (key.startsWith(`${userId}:`)) {
      rateLimitStore.delete(key)
    }
  }
}
