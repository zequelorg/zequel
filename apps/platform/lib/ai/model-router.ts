import type { RequestType } from '@zequel/shared/validation/ai-schema'
import type { SubscriptionPlan } from '@zequel/shared/security/subscription'

// ============================================================================
// ZEQUEL MODEL ROUTER
// Controls which OpenRouter model a user gets based on their plan + feature.
//
// | Feature                 | Free       | Premium Lite | Premium Pro |
// | ----------------------- | ---------- | ------------ | ----------- |
// | Normal Chat             | gpt-5-nano | gpt-5-mini   | gpt-5       |
// | Study Mode              | gpt-5-nano | gpt-5-mini   | gpt-5       |
// | Research Mode           | --         | gpt-5        | gpt-5       |
// | Multi-Document Analysis | --         | gpt-5        | gpt-5       |
// | Coding Mode             | --         | --           | gpt-5       |
// | Long Report Generation  | --         | gpt-5        | gpt-5       |
// | Deep Reasoning          | --         | gpt-5        | gpt-5       |
//
// Fallback model (used if the primary model errors): gpt-5-nano
// ============================================================================

// Exact OpenRouter model identifiers
export const MODELS = {
  NANO: 'openai/gpt-5-nano',
  MINI: 'openai/gpt-5-mini',
  FULL: 'openai/gpt-5',
} as const

// Fallback model used whenever the primary model call fails
export const FALLBACK_MODEL = MODELS.NANO

// Features that map to the pricing table above
export type AIFeature =
  | 'chat' // Normal chat + Study mode (single document)
  | 'research' // Research mode (structured analysis)
  | 'multi_document' // Multi-document analysis (2+ documents)
  | 'coding' // Coding mode
  | 'long_report' // Long report generation
  | 'deep_reasoning' // Deep reasoning

// null = the plan does NOT have access to that feature
const FEATURE_MODEL_MATRIX: Record<AIFeature, Record<SubscriptionPlan, string | null>> = {
  chat: {
    free: MODELS.NANO,
    premium_lite: MODELS.MINI,
    premium_pro: MODELS.FULL,
  },
  research: {
    free: null,
    premium_lite: MODELS.FULL,
    premium_pro: MODELS.FULL,
  },
  multi_document: {
    free: null,
    premium_lite: MODELS.FULL,
    premium_pro: MODELS.FULL,
  },
  coding: {
    free: null,
    premium_lite: null,
    premium_pro: MODELS.FULL,
  },
  long_report: {
    free: null,
    premium_lite: MODELS.FULL,
    premium_pro: MODELS.FULL,
  },
  deep_reasoning: {
    free: null,
    premium_lite: MODELS.FULL,
    premium_pro: MODELS.FULL,
  },
}

// Human-readable feature labels (used in upgrade messages)
const FEATURE_LABELS: Record<AIFeature, string> = {
  chat: 'Chat',
  research: 'Research Mode',
  multi_document: 'Multi-Document Analysis',
  coding: 'Coding Mode',
  long_report: 'Long Report Generation',
  deep_reasoning: 'Deep Reasoning',
}

const PLAN_LABELS: Record<SubscriptionPlan, string> = {
  free: 'Free',
  premium_lite: 'Premium Lite',
  premium_pro: 'Premium Pro',
}

export interface ModelResolution {
  // Whether the plan is allowed to use this feature at all
  allowed: boolean
  // The model to use as the primary request (empty when not allowed)
  model: string
  // The fallback model to retry with if the primary fails
  fallback: string
  // Why access was denied (only set when allowed === false)
  reason?: string
  // The cheapest plan that unlocks this feature (only set when allowed === false)
  requiredPlan?: SubscriptionPlan
}

/**
 * Determine the lowest plan that has access to a feature.
 */
function getRequiredPlan(feature: AIFeature): SubscriptionPlan | undefined {
  const row = FEATURE_MODEL_MATRIX[feature]
  if (row.free) return 'free'
  if (row.premium_lite) return 'premium_lite'
  if (row.premium_pro) return 'premium_pro'
  return undefined
}

/**
 * Resolve which model a user on `plan` gets for `feature`.
 * Returns access denial info when the plan is not entitled to the feature.
 */
export function resolveModel(feature: AIFeature, plan: SubscriptionPlan): ModelResolution {
  const model = FEATURE_MODEL_MATRIX[feature]?.[plan] ?? null

  if (!model) {
    const requiredPlan = getRequiredPlan(feature)
    const requiredLabel = requiredPlan ? PLAN_LABELS[requiredPlan] : 'a premium'
    return {
      allowed: false,
      model: '',
      fallback: FALLBACK_MODEL,
      reason: `${FEATURE_LABELS[feature]} is not available on the ${PLAN_LABELS[plan]} plan. Upgrade to ${requiredLabel} to unlock it.`,
      requiredPlan,
    }
  }

  return {
    allowed: true,
    model,
    fallback: FALLBACK_MODEL,
  }
}

/**
 * Map an incoming request to its billable feature.
 * - chat endpoint: single/no document = chat (study), 2+ documents = multi-document analysis
 * - query endpoint: research mode, escalates to multi-document with 2+ documents
 */
export function resolveFeature(
  requestType: RequestType,
  opts?: { documentCount?: number; coding?: boolean; longReport?: boolean; deepReasoning?: boolean }
): AIFeature {
  const documentCount = opts?.documentCount ?? 0

  if (opts?.coding) return 'coding'
  if (opts?.deepReasoning) return 'deep_reasoning'
  if (opts?.longReport) return 'long_report'

  if (requestType === 'query') {
    return documentCount > 1 ? 'multi_document' : 'research'
  }

  // chat / extract
  if (documentCount > 1) return 'multi_document'
  return 'chat'
}

export function getFeatureLabel(feature: AIFeature): string {
  return FEATURE_LABELS[feature]
}
