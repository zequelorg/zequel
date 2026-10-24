import { createClient as createServerClient } from '@zequel/shared/supabase/server'
import { createServiceClient } from '@zequel/shared/supabase/service'
import { getUserSubscription, isPremiumPlan, type SubscriptionPlan } from '@zequel/shared/security/subscription'
import { resolveModel, resolveFeature, type AIFeature } from '@/lib/ai/model-router'
import { logAIUsage, estimateTokens } from '@/lib/logging/ai-logger'
import { validateRequest, chatRequestSchema, queryRequestSchema, type RequestType } from '@zequel/shared/validation/ai-schema'
import { getSystemSettings, isAIEnabled, type SystemSettings } from '@zequel/shared/settings/system-settings'
import { checkAdvancedRateLimit, checkIPLimit, type RateLimitResult } from '@zequel/shared/security/advanced-rate-limit'
import { buildSystemPrompt, validateResponseQuality, buildRetryPrompt } from '@/lib/ai/prompt-builder'
import type { z } from 'zod'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

interface AIRequestOptions {
  messages: Array<{ role: string; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }>
  stream?: boolean
  hasImages?: boolean
  // Feature being used — drives model selection per plan (see model-router.ts)
  feature?: AIFeature
  // Number of documents in the request (used to detect multi-document analysis)
  documentCount?: number
}

interface AIServiceResult {
  success: boolean
  error?: string
  statusCode?: number
  data?: unknown
  stream?: ReadableStream
  metadata?: {
    model: string
    tokens_used?: number
    settings?: SystemSettings
  }
}

export interface AuthenticatedUser {
  id: string
  email?: string
}

// Standardized AI response format
export interface AIResponse<T = string> {
  success: boolean
  data: T
  metadata: {
    model: string
    tokens_used: number
    latency_ms: number
  }
  error?: string
}

/**
 * Check daily usage for a user
 */
async function checkDailyUsage(userId: string, limit: number): Promise<{ allowed: boolean; used: number; remaining: number }> {
  const supabase = createServiceClient()
  
  // Get today's start in UTC
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  
  const { count } = await supabase
    .from('ai_usage_logs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'success')
    .gte('created_at', today.toISOString())

  const used = count || 0
  const remaining = Math.max(0, limit - used)
  
  return {
    allowed: used < limit,
    used,
    remaining,
  }
}

/**
 * Main entry point for all AI requests
 * Handles: auth, validation, system settings check, rate limiting, subscription check
 */
export async function processAIRequest(
  requestType: RequestType,
  body: unknown,
  options?: { skipValidation?: boolean }
): Promise<AIServiceResult> {
  const startTime = Date.now()
  
  try {
    // 1. Fetch system settings (cached)
    const settings = await getSystemSettings()
  
    // 2. Check if AI is globally enabled
    if (!settings.ai_enabled) {
      return { 
        success: false, 
        error: 'AI is temporarily disabled. Please try again later.', 
        statusCode: 503 
      }
    }
    
    // 3. Check maintenance mode
    if (settings.maintenance_mode) {
      return { 
        success: false, 
        error: 'System is under maintenance. Please try again later.', 
        statusCode: 503 
      }
    }

    // 4. Authenticate user
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return { success: false, error: 'Unauthorized', statusCode: 401 }
    }

    // 5. Check if user is suspended
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('suspended')
      .eq('id', user.id)
      .single()
    
    // Only block if suspended is explicitly true (handle cases where column might not exist yet)
    if (profile?.suspended === true) {
      return { 
        success: false, 
        error: 'Your account has been suspended. Please contact support.', 
        statusCode: 403 
      }
    }
    
    // Log profile fetch errors but don't block (suspended column might not exist yet)
    if (profileError && profileError.code !== 'PGRST116') {
      console.error('[Zequel] Profile fetch error:', profileError)
    }

    // 6. Validate input
    if (!options?.skipValidation) {
      const schema = requestType === 'chat' ? chatRequestSchema : queryRequestSchema
      const validation = validateRequest(schema as z.ZodSchema<unknown>, body)
      if (!validation.success) {
        const errorResult = validation as { success: false; error: string }
        await logAIUsage({
          user_id: user.id,
          endpoint: requestType,
          model: 'none',
          status: 'error',
          error_message: errorResult.error,
        })
        return { success: false, error: errorResult.error, statusCode: 400 }
      }
    }

    // 7. Check subscription
    const subscription = await getUserSubscription(user.id)
    const isPremium = isPremiumPlan(subscription.plan)

    // 8. Advanced rate limit check (burst, per-minute, per-hour, daily)
    const rateLimitResult = await checkAdvancedRateLimit(
      user.id,
      requestType,
      isPremium,
      settings
    )
    
    if (!rateLimitResult.allowed) {
      await logAIUsage({
        user_id: user.id,
        endpoint: requestType,
        model: 'none',
        status: 'rate_limited',
        error_message: `Rate limit: ${rateLimitResult.violation} - ${rateLimitResult.message}`,
      })
      return {
        success: false,
        error: rateLimitResult.message || 'Rate limit exceeded',
        statusCode: 429,
        data: { retryAfter: rateLimitResult.retryAfter, violation: rateLimitResult.violation },
      }
    }

    // Return authenticated context for route handlers to use
    return {
      success: true,
      data: {
        user,
        subscription,
        isPremium,
        rateLimitResult,
        startTime,
        settings,
      },
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Internal server error'
    console.error('[Zequel] processAIRequest error:', errorMessage)
    
    // Handle specific configuration errors
    if (errorMessage === 'SUPABASE_URL_MISSING' || errorMessage === 'SUPABASE_SERVICE_KEY_MISSING') {
      return {
        success: false,
        error: 'Database service is not configured. Please check environment variables.',
        statusCode: 503,
      }
    }
    
    return {
      success: false,
      error: errorMessage,
      statusCode: 500,
    }
  }
}

/**
 * Get model configuration based on plan + feature.
 * Model selection comes from the plan/feature matrix in model-router.ts.
 * Token budget and temperature still come from system settings.
 */
function getModelConfig(
  settings: SystemSettings,
  requestType: RequestType,
  plan: SubscriptionPlan,
  feature: AIFeature
) {
  const isPremium = isPremiumPlan(plan)
  const resolution = resolveModel(feature, plan)

  // Max tokens from settings, adjusted by plan
  const maxTokens = isPremium
    ? Math.min(settings.max_tokens_per_request * 2, 65536)
    : settings.max_tokens_per_request

  // Temperature varies by request type
  const temperatures: Record<RequestType, number> = {
    chat: 0.4,
    query: 0.3,
    extract: 0.2,
  }

  return {
    allowed: resolution.allowed,
    primary: resolution.model,
    fallback: resolution.fallback,
    reason: resolution.reason,
    requiredPlan: resolution.requiredPlan,
    maxTokens,
    temperature: temperatures[requestType],
  }
}

/**
 * Execute AI call with proper security and logging
 */
export async function executeAICall(
  userId: string,
  requestType: RequestType,
  options: AIRequestOptions,
  plan: SubscriptionPlan = 'free',
  startTime: number = Date.now(),
  settings?: SystemSettings
): Promise<AIServiceResult> {
  // Fetch settings if not provided
  const systemSettings = settings || await getSystemSettings()

  // Determine which billable feature this request maps to, then resolve the
  // model the user's plan is entitled to for that feature.
  const feature = options.feature
    ?? resolveFeature(requestType, { documentCount: options.documentCount })
  const modelConfig = getModelConfig(systemSettings, requestType, plan, feature)

  // Plan is not entitled to this feature — block before spending any tokens.
  if (!modelConfig.allowed) {
    await logAIUsage({
      user_id: userId,
      endpoint: requestType,
      model: 'none',
      status: 'error',
      error_message: modelConfig.reason || 'Feature not available on current plan',
      latency_ms: Date.now() - startTime,
    })
    return {
      success: false,
      error: modelConfig.reason || 'This feature is not available on your current plan.',
      statusCode: 403,
      data: { upgradeRequired: true, requiredPlan: modelConfig.requiredPlan },
    }
  }

  const model = modelConfig.primary

  // Build system prompt using centralized prompt builder
  const zequelSystemPrompt = buildSystemPrompt(systemSettings)
  
  // Prepend Zequel system prompt to messages
  const messages = [...options.messages]
  if (messages[0]?.role === 'system') {
    messages[0] = {
      ...messages[0],
      content: zequelSystemPrompt + '\n\n' + messages[0].content,
    }
  } else {
    messages.unshift({ role: 'system', content: zequelSystemPrompt })
  }

  // Estimate input tokens for logging
  const inputTokens = messages.reduce((acc, m) => {
    if (typeof m.content === 'string') {
      return acc + estimateTokens(m.content)
    }
    return acc + 100 // Rough estimate for multimodal
  }, 0)

  // Check if OpenRouter API key is configured
  if (!process.env.OPENROUTER_API_KEY) {
    console.error('[Zequel] OPENROUTER_API_KEY is not configured')
    await logAIUsage({
      user_id: userId,
      endpoint: requestType,
      model,
      input_tokens: inputTokens,
      status: 'error',
      error_message: 'OpenRouter API key not configured',
      latency_ms: Date.now() - startTime,
    })
    return { 
      success: false, 
      error: 'AI service is not configured. Please contact support.', 
      statusCode: 503 
    }
  }

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://zequel.xyz',
        'X-Title': 'Zequel Research System',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: modelConfig.temperature,
        max_tokens: modelConfig.maxTokens,
        stream: options.stream ?? false,
        top_p: 0.95,
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('OpenRouter error:', errText)
      
      // Try fallback model
      const fallbackResponse = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://zequel.xyz',
          'X-Title': 'Zequel Research System',
        },
        body: JSON.stringify({
          model: modelConfig.fallback,
          messages,
          temperature: modelConfig.temperature,
          max_tokens: modelConfig.maxTokens,
          stream: options.stream ?? false,
        }),
      })

      if (!fallbackResponse.ok) {
        await logAIUsage({
          user_id: userId,
          endpoint: requestType,
          model,
          input_tokens: inputTokens,
          status: 'error',
          error_message: 'Both primary and fallback models failed',
          latency_ms: Date.now() - startTime,
        })
        return { success: false, error: 'AI processing failed', statusCode: 502 }
      }

      // Fallback succeeded
      if (options.stream) {
        return { 
          success: true, 
          stream: fallbackResponse.body as ReadableStream, 
          data: { model: modelConfig.fallback },
          metadata: { model: modelConfig.fallback, settings: systemSettings }
        }
      }
      
      const result = await fallbackResponse.json()
      const outputTokens = estimateTokens(result.choices?.[0]?.message?.content || '')
      
      await logAIUsage({
        user_id: userId,
        endpoint: requestType,
        model: modelConfig.fallback,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        status: 'success',
        latency_ms: Date.now() - startTime,
      })
      
      return { 
        success: true, 
        data: result,
        metadata: { model: modelConfig.fallback, tokens_used: inputTokens + outputTokens, settings: systemSettings }
      }
    }

    // Primary model succeeded
    if (options.stream) {
      return { 
        success: true, 
        stream: response.body as ReadableStream, 
        data: { model, inputTokens, startTime, userId, requestType },
        metadata: { model, settings: systemSettings }
      }
    }

    const result = await response.json()
    const responseContent = result.choices?.[0]?.message?.content || ''
    const outputTokens = estimateTokens(responseContent)

    // Validate response quality for non-streaming responses
    const qualityCheck = validateResponseQuality(responseContent)
    
    // If quality is poor and this isn't already a retry, attempt one retry with improved prompt
    if (!qualityCheck.valid && !options.hasImages && requestType !== 'extract') {
      const userMessage = messages.find(m => m.role === 'user')
      if (userMessage && typeof userMessage.content === 'string') {
        const retryPrompt = buildRetryPrompt(
          userMessage.content,
          responseContent,
          qualityCheck.issues
        )
        
        // Single retry with improved prompt
        const retryResponse = await fetch(OPENROUTER_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://zequel.xyz',
            'X-Title': 'Zequel Research System',
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: zequelSystemPrompt },
              { role: 'user', content: retryPrompt },
            ],
            temperature: modelConfig.temperature + 0.1, // Slightly higher temperature for variety
            max_tokens: modelConfig.maxTokens,
            stream: false,
          }),
        })

        if (retryResponse.ok) {
          const retryResult = await retryResponse.json()
          const retryContent = retryResult.choices?.[0]?.message?.content || ''
          const retryQuality = validateResponseQuality(retryContent)
          
          // Use retry result if it's better
          if (retryQuality.valid || retryContent.length > responseContent.length) {
            const retryTokens = estimateTokens(retryContent)
            await logAIUsage({
              user_id: userId,
              endpoint: requestType,
              model,
              input_tokens: inputTokens + estimateTokens(retryPrompt),
              output_tokens: retryTokens,
              status: 'success',
              latency_ms: Date.now() - startTime,
            })
            return { 
              success: true, 
              data: retryResult,
              metadata: { model, tokens_used: inputTokens + retryTokens + outputTokens, settings: systemSettings }
            }
          }
        }
      }
    }

    await logAIUsage({
      user_id: userId,
      endpoint: requestType,
      model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      status: 'success',
      latency_ms: Date.now() - startTime,
    })

    return { 
      success: true, 
      data: result,
      metadata: { model, tokens_used: inputTokens + outputTokens, settings: systemSettings }
    }
  } catch (err) {
    console.error('AI call error:', err)
    await logAIUsage({
      user_id: userId,
      endpoint: requestType,
      model,
      input_tokens: inputTokens,
      status: 'error',
      error_message: err instanceof Error ? err.message : 'Unknown error',
      latency_ms: Date.now() - startTime,
    })
    return { success: false, error: 'AI service unavailable', statusCode: 503 }
  }
}

/**
 * Log streaming completion
 */
export async function logStreamCompletion(
  userId: string,
  requestType: RequestType,
  model: string,
  inputTokens: number,
  outputTokens: number,
  startTime: number,
  status: 'success' | 'error' = 'success',
  errorMessage?: string
): Promise<void> {
  await logAIUsage({
    user_id: userId,
    endpoint: requestType,
    model,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    status,
    error_message: errorMessage,
    latency_ms: Date.now() - startTime,
  })
}

/**
 * Create standardized AI response
 */
export function createAIResponse<T>(
  success: boolean,
  data: T,
  model: string,
  tokensUsed: number,
  latencyMs: number,
  error?: string
): AIResponse<T> {
  return {
    success,
    data,
    metadata: {
      model,
      tokens_used: tokensUsed,
      latency_ms: latencyMs,
    },
    error,
  }
}
