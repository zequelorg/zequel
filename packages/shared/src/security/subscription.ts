import { createClient as createServerClient } from '../supabase/server'

export type SubscriptionPlan = 'free' | 'premium_lite' | 'premium_pro'

export interface Subscription {
  user_id: string
  plan: SubscriptionPlan
  request_limit: number
  expires_at: string | null
  is_active: boolean
}

// Default limits per plan
const PLAN_LIMITS: Record<SubscriptionPlan, { requestLimit: number }> = {
  free: { requestLimit: 20 },
  premium_lite: { requestLimit: 200 },
  premium_pro: { requestLimit: 1000 },
}

/**
 * Normalize a raw plan value from the database into a canonical SubscriptionPlan.
 * Tolerates spaces, dashes, and casing (e.g. "premium pro", "Premium-Pro" -> "premium_pro")
 * and legacy tier names ("premium" -> premium_lite, "enterprise" -> premium_pro).
 */
export function normalizePlan(raw: unknown): SubscriptionPlan {
  if (typeof raw !== 'string') return 'free'
  const normalized = raw.trim().toLowerCase().replace(/[\s-]+/g, '_')
  switch (normalized) {
    case 'premium_pro':
    case 'enterprise':
      return 'premium_pro'
    case 'premium_lite':
    case 'premium':
      return 'premium_lite'
    default:
      return 'free'
  }
}

export async function getUserSubscription(userId: string): Promise<Subscription> {
  try {
    const supabase = await createServerClient()
    
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error || !data) {
      // No subscription found - return free tier
      return {
        user_id: userId,
        plan: 'free',
        request_limit: PLAN_LIMITS.free.requestLimit,
        expires_at: null,
        is_active: true,
      }
    }

    // Check if subscription is expired
    const isExpired = data.expires_at && new Date(data.expires_at) < new Date()
    
    if (isExpired) {
      return {
        user_id: userId,
        plan: 'free',
        request_limit: PLAN_LIMITS.free.requestLimit,
        expires_at: data.expires_at,
        is_active: false,
      }
    }

    // Normalize the stored plan value (tolerates "premium pro", casing, etc.)
    const plan = normalizePlan(data.plan)

    return {
      user_id: data.user_id,
      plan,
      request_limit: data.request_limit || PLAN_LIMITS[plan].requestLimit,
      expires_at: data.expires_at,
      is_active: true,
    }
  } catch {
    // On error, default to free tier
    return {
      user_id: userId,
      plan: 'free',
      request_limit: PLAN_LIMITS.free.requestLimit,
      expires_at: null,
      is_active: true,
    }
  }
}

export function isPremiumPlan(plan: SubscriptionPlan): boolean {
  return plan === 'premium_lite' || plan === 'premium_pro'
}
