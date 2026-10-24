import type { RequestType } from '../validation/ai-schema'
import type { SystemSettings } from '../settings/system-settings'
import { createServiceClient } from '../supabase/service'

// ============================================================================
// ADVANCED RATE LIMITING & ABUSE PROTECTION FOR ZEQUEL
// ============================================================================

// In-memory stores (use Redis in production for multi-instance deployments)
const minuteStore = new Map<string, { count: number; resetAt: number }>()
const hourStore = new Map<string, { count: number; resetAt: number }>()
const dailyStore = new Map<string, { count: number; resetAt: number }>()
const burstStore = new Map<string, { timestamps: number[]; blockedUntil: number }>()
const ipStore = new Map<string, { count: number; resetAt: number; blocked: boolean; blockedUntil: number }>()

// Time windows
const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000
const BURST_WINDOW_MS = 5 * 1000 // 5 second window for burst detection

// Default limits (overridden by system_settings)
const DEFAULT_LIMITS = {
  max_requests_per_minute: 15,
  max_requests_per_hour: 100,
  burst_limit_threshold: 5, // max requests in 5 seconds
  burst_cooldown_seconds: 30,
  ip_limit_per_minute: 30, // For non-authenticated users
  ip_block_threshold: 100, // Block IP after this many requests per minute
}

// ============================================================================
// RATE LIMIT RESULT TYPES
// ============================================================================

export type ViolationType = 'minute' | 'hour' | 'daily' | 'burst' | 'ip' | 'blocked'

export interface RateLimitResult {
  allowed: boolean
  violation?: ViolationType
  message?: string
  retryAfter?: number // seconds until retry allowed
  remaining?: {
    minute: number
    hour: number
    daily: number
  }
}

export interface RateLimitSettings {
  max_requests_per_minute: number
  max_requests_per_hour: number
  burst_limit_threshold: number
  burst_cooldown_seconds: number
}

// ============================================================================
// EXTENDED SYSTEM SETTINGS
// ============================================================================

export interface ExtendedSystemSettings extends SystemSettings {
  max_requests_per_minute: number
  max_requests_per_hour: number
  burst_limit_threshold: number
  burst_cooldown_seconds: number
}

export function getRateLimitSettings(settings: Partial<ExtendedSystemSettings>): RateLimitSettings {
  return {
    max_requests_per_minute: settings.max_requests_per_minute ?? DEFAULT_LIMITS.max_requests_per_minute,
    max_requests_per_hour: settings.max_requests_per_hour ?? DEFAULT_LIMITS.max_requests_per_hour,
    burst_limit_threshold: settings.burst_limit_threshold ?? DEFAULT_LIMITS.burst_limit_threshold,
    burst_cooldown_seconds: settings.burst_cooldown_seconds ?? DEFAULT_LIMITS.burst_cooldown_seconds,
  }
}

// ============================================================================
// BURST PROTECTION
// ============================================================================

function checkBurstLimit(
  userId: string,
  threshold: number,
  cooldownSeconds: number
): { allowed: boolean; blockedFor?: number } {
  const key = `burst:${userId}`
  const now = Date.now()
  
  const current = burstStore.get(key)
  
  // Check if user is currently blocked
  if (current?.blockedUntil && now < current.blockedUntil) {
    return { allowed: false, blockedFor: Math.ceil((current.blockedUntil - now) / 1000) }
  }
  
  // Get recent timestamps within burst window
  const timestamps = current?.timestamps?.filter(t => now - t < BURST_WINDOW_MS) || []
  
  // Add current request timestamp
  timestamps.push(now)
  
  // Check if burst threshold exceeded
  if (timestamps.length > threshold) {
    // Block user for cooldown period
    burstStore.set(key, {
      timestamps: [],
      blockedUntil: now + (cooldownSeconds * 1000)
    })
    return { allowed: false, blockedFor: cooldownSeconds }
  }
  
  // Update timestamps
  burstStore.set(key, { timestamps, blockedUntil: 0 })
  return { allowed: true }
}

// ============================================================================
// PER-MINUTE RATE LIMITING
// ============================================================================

function checkMinuteLimit(
  userId: string,
  limit: number,
  isPremium: boolean
): { allowed: boolean; remaining: number; resetIn: number } {
  const key = `min:${userId}`
  const now = Date.now()
  const actualLimit = isPremium ? limit * 2 : limit // Premium users get 2x
  
  const current = minuteStore.get(key)
  
  // Reset if window expired
  if (!current || now > current.resetAt) {
    minuteStore.set(key, { count: 1, resetAt: now + MINUTE_MS })
    return { allowed: true, remaining: actualLimit - 1, resetIn: MINUTE_MS }
  }
  
  if (current.count >= actualLimit) {
    return { allowed: false, remaining: 0, resetIn: current.resetAt - now }
  }
  
  current.count++
  minuteStore.set(key, current)
  return { allowed: true, remaining: actualLimit - current.count, resetIn: current.resetAt - now }
}

// ============================================================================
// PER-HOUR RATE LIMITING
// ============================================================================

function checkHourLimit(
  userId: string,
  limit: number,
  isPremium: boolean
): { allowed: boolean; remaining: number; resetIn: number } {
  const key = `hour:${userId}`
  const now = Date.now()
  const actualLimit = isPremium ? limit * 2 : limit
  
  const current = hourStore.get(key)
  
  if (!current || now > current.resetAt) {
    hourStore.set(key, { count: 1, resetAt: now + HOUR_MS })
    return { allowed: true, remaining: actualLimit - 1, resetIn: HOUR_MS }
  }
  
  if (current.count >= actualLimit) {
    return { allowed: false, remaining: 0, resetIn: current.resetAt - now }
  }
  
  current.count++
  hourStore.set(key, current)
  return { allowed: true, remaining: actualLimit - current.count, resetIn: current.resetAt - now }
}

// ============================================================================
// DAILY RATE LIMITING
// ============================================================================

function checkDailyLimit(
  userId: string,
  freeLimit: number,
  premiumLiteLimit: number,
  premiumProLimit: number,
  plan: 'free' | 'premium_lite' | 'premium_pro'
): { allowed: boolean; remaining: number; resetIn: number } {
  const key = `daily:${userId}`
  const now = Date.now()
  const limit = plan === 'premium_pro' ? premiumProLimit : plan === 'premium_lite' ? premiumLiteLimit : freeLimit
  
  const current = dailyStore.get(key)
  
  if (!current || now > current.resetAt) {
    dailyStore.set(key, { count: 1, resetAt: now + DAY_MS })
    return { allowed: true, remaining: limit - 1, resetIn: DAY_MS }
  }
  
  if (current.count >= limit) {
    return { allowed: false, remaining: 0, resetIn: current.resetAt - now }
  }
  
  current.count++
  dailyStore.set(key, current)
  return { allowed: true, remaining: limit - current.count, resetIn: current.resetAt - now }
}

// ============================================================================
// IP-BASED RATE LIMITING (for unauthenticated or suspicious traffic)
// ============================================================================

export function checkIPLimit(ip: string): { allowed: boolean; blockedFor?: number } {
  const key = `ip:${ip}`
  const now = Date.now()
  
  const current = ipStore.get(key)
  
  // Check if IP is blocked
  if (current?.blocked && current.blockedUntil > now) {
    return { allowed: false, blockedFor: Math.ceil((current.blockedUntil - now) / 1000) }
  }
  
  // Reset if window expired
  if (!current || now > current.resetAt) {
    ipStore.set(key, { count: 1, resetAt: now + MINUTE_MS, blocked: false, blockedUntil: 0 })
    return { allowed: true }
  }
  
  current.count++
  
  // Check if should block this IP
  if (current.count > DEFAULT_LIMITS.ip_block_threshold) {
    current.blocked = true
    current.blockedUntil = now + (5 * MINUTE_MS) // Block for 5 minutes
    ipStore.set(key, current)
    return { allowed: false, blockedFor: 300 }
  }
  
  // Check if exceeds per-minute limit
  if (current.count > DEFAULT_LIMITS.ip_limit_per_minute) {
    ipStore.set(key, current)
    return { allowed: false }
  }
  
  ipStore.set(key, current)
  return { allowed: true }
}

// ============================================================================
// MAIN RATE LIMIT CHECK - COMBINES ALL LAYERS
// ============================================================================

export async function checkAdvancedRateLimit(
  userId: string,
  endpoint: RequestType,
  isPremium: boolean,
  settings: Partial<ExtendedSystemSettings>,
  ip?: string
): Promise<RateLimitResult> {
  const rateLimitSettings = getRateLimitSettings(settings)
  
  // 1. Check burst protection first (fastest rejection)
  const burstCheck = checkBurstLimit(
    userId,
    rateLimitSettings.burst_limit_threshold,
    rateLimitSettings.burst_cooldown_seconds
  )
  if (!burstCheck.allowed) {
    await logRateLimitViolation(userId, ip, 'burst')
    return {
      allowed: false,
      violation: 'burst',
      message: 'Rate limit exceeded. Please wait before trying again.',
      retryAfter: burstCheck.blockedFor,
    }
  }
  
  // 2. Check per-minute limit
  const minuteCheck = checkMinuteLimit(
    userId,
    rateLimitSettings.max_requests_per_minute,
    isPremium
  )
  if (!minuteCheck.allowed) {
    await logRateLimitViolation(userId, ip, 'minute')
    return {
      allowed: false,
      violation: 'minute',
      message: 'Too many requests. Please slow down.',
      retryAfter: Math.ceil(minuteCheck.resetIn / 1000),
    }
  }
  
  // 3. Check per-hour limit
  const hourCheck = checkHourLimit(
    userId,
    rateLimitSettings.max_requests_per_hour,
    isPremium
  )
  if (!hourCheck.allowed) {
    await logRateLimitViolation(userId, ip, 'hour')
    return {
      allowed: false,
      violation: 'hour',
      message: 'Hourly request limit reached. Please try again later.',
      retryAfter: Math.ceil(hourCheck.resetIn / 1000),
    }
  }
  
  // 4. Check daily limit
  const dailyCheck = checkDailyLimit(
    userId,
    settings.free_daily_limit ?? 20,
    settings.premium_lite_daily_limit ?? 200,
    settings.premium_pro_daily_limit ?? 1000,
    isPremium ? 'premium_lite' : 'free' // simplified - actual plan should be passed
  )
  if (!dailyCheck.allowed) {
    await logRateLimitViolation(userId, ip, 'daily')
    return {
      allowed: false,
      violation: 'daily',
      message: 'Daily usage limit reached. Upgrade to premium for higher limits.',
      retryAfter: Math.ceil(dailyCheck.resetIn / 1000),
    }
  }
  
  // All checks passed
  return {
    allowed: true,
    remaining: {
      minute: minuteCheck.remaining,
      hour: hourCheck.remaining,
      daily: dailyCheck.remaining,
    },
  }
}

// ============================================================================
// RATE LIMIT VIOLATION LOGGING
// ============================================================================

export async function logRateLimitViolation(
  userId: string | null,
  ip: string | undefined,
  violationType: ViolationType
): Promise<void> {
  try {
    const supabase = createServiceClient()
    
    await supabase.from('rate_limit_violations').insert({
      user_id: userId,
      ip_address: ip || 'unknown',
      violation_type: violationType,
      created_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Failed to log rate limit violation:', error)
  }
}

// ============================================================================
// GET USER USAGE STATS (for admin dashboard)
// ============================================================================

export function getUserUsageStats(userId: string): {
  minute: { count: number; limit: number; resetIn: number }
  hour: { count: number; limit: number; resetIn: number }
  daily: { count: number; limit: number; resetIn: number }
} | null {
  const now = Date.now()
  
  const minuteData = minuteStore.get(`min:${userId}`)
  const hourData = hourStore.get(`hour:${userId}`)
  const dailyData = dailyStore.get(`daily:${userId}`)
  
  return {
    minute: {
      count: minuteData?.count || 0,
      limit: DEFAULT_LIMITS.max_requests_per_minute,
      resetIn: minuteData ? Math.max(0, minuteData.resetAt - now) : 0,
    },
    hour: {
      count: hourData?.count || 0,
      limit: DEFAULT_LIMITS.max_requests_per_hour,
      resetIn: hourData ? Math.max(0, hourData.resetAt - now) : 0,
    },
    daily: {
      count: dailyData?.count || 0,
      limit: DEFAULT_LIMITS.max_requests_per_minute, // Will be overridden by actual settings
      resetIn: dailyData ? Math.max(0, dailyData.resetAt - now) : 0,
    },
  }
}

// ============================================================================
// CLEANUP EXPIRED ENTRIES (call periodically)
// ============================================================================

export function cleanupRateLimitStores(): void {
  const now = Date.now()
  
  for (const [key, value] of minuteStore.entries()) {
    if (now > value.resetAt) minuteStore.delete(key)
  }
  
  for (const [key, value] of hourStore.entries()) {
    if (now > value.resetAt) hourStore.delete(key)
  }
  
  for (const [key, value] of dailyStore.entries()) {
    if (now > value.resetAt) dailyStore.delete(key)
  }
  
  for (const [key, value] of burstStore.entries()) {
    if (value.blockedUntil < now && value.timestamps.length === 0) {
      burstStore.delete(key)
    }
  }
  
  for (const [key, value] of ipStore.entries()) {
    if (now > value.resetAt && !value.blocked) ipStore.delete(key)
  }
}

// ============================================================================
// CLEAR USER RATE LIMITS (e.g., after subscription upgrade)
// ============================================================================

export function clearUserRateLimits(userId: string): void {
  minuteStore.delete(`min:${userId}`)
  hourStore.delete(`hour:${userId}`)
  dailyStore.delete(`daily:${userId}`)
  burstStore.delete(`burst:${userId}`)
}

// ============================================================================
// BLOCK/UNBLOCK USER MANUALLY
// ============================================================================

export function blockUser(userId: string, durationSeconds: number): void {
  const now = Date.now()
  burstStore.set(`burst:${userId}`, {
    timestamps: [],
    blockedUntil: now + (durationSeconds * 1000)
  })
}

export function unblockUser(userId: string): void {
  burstStore.delete(`burst:${userId}`)
}

// ============================================================================
// GET TOP USERS BY REQUEST VOLUME (for admin)
// ============================================================================

export function getTopUsersByVolume(limit: number = 10): Array<{
  userId: string
  dailyCount: number
}> {
  const users: Array<{ userId: string; dailyCount: number }> = []
  
  for (const [key, value] of dailyStore.entries()) {
    const userId = key.replace('daily:', '')
    users.push({ userId, dailyCount: value.count })
  }
  
  return users.sort((a, b) => b.dailyCount - a.dailyCount).slice(0, limit)
}
