import { createServiceClient, canCreateServiceClient } from '../supabase/service'

// Response style type
export type ResponseStyle = 'concise' | 'detailed' | 'academic'

// System settings interface - single source of truth
export interface SystemSettings {
  ai_enabled: boolean
  free_daily_limit: number
  premium_lite_daily_limit: number
  premium_pro_daily_limit: number
  max_file_uploads_free: number
  max_file_uploads_premium_lite: number
  max_file_uploads_premium_pro: number
  max_tokens_per_request: number
  default_model: string
  file_uploads_enabled: boolean
  max_file_size_mb: number
  maintenance_mode: boolean
  // Advanced rate limiting settings
  max_requests_per_minute: number
  max_requests_per_hour: number
  burst_limit_threshold: number
  burst_cooldown_seconds: number
  // Response quality settings
  response_style: ResponseStyle
}

// Default settings - used if database is unavailable
const DEFAULT_SETTINGS: SystemSettings = {
  ai_enabled: true,
  free_daily_limit: 20,
  premium_lite_daily_limit: 200,
  premium_pro_daily_limit: 1000,
  max_file_uploads_free: 3,
  max_file_uploads_premium_lite: 30,
  max_file_uploads_premium_pro: 100,
  max_tokens_per_request: 16384,
  default_model: 'openai/gpt-5-nano',
  file_uploads_enabled: true,
  max_file_size_mb: 10,
  maintenance_mode: false,
  // Advanced rate limiting defaults
  max_requests_per_minute: 15,
  max_requests_per_hour: 100,
  burst_limit_threshold: 5,
  burst_cooldown_seconds: 30,
  // Response quality defaults
  response_style: 'detailed',
}

// Cache settings for 60 seconds to reduce DB calls
let cachedSettings: SystemSettings | null = null
let cacheTimestamp = 0
const CACHE_TTL = 60 * 1000 // 60 seconds

/**
 * Fetch system settings from database (singleton pattern)
 * Caches results for 60 seconds to reduce database load
 */
export async function getSystemSettings(): Promise<SystemSettings> {
  const now = Date.now()
  
  // Return cached settings if still valid
  if (cachedSettings && (now - cacheTimestamp) < CACHE_TTL) {
    return cachedSettings
  }

  // Check if we can create the service client
  if (!canCreateServiceClient()) {
    console.warn('[Zequel] Service client unavailable, using default settings')
    return DEFAULT_SETTINGS
  }

  try {
    const supabase = createServiceClient()
    
    const { data: rows, error } = await supabase
      .from('system_settings')
      .select('key, value')

    if (error || !rows || rows.length === 0) {
      // Return defaults if table is empty or error
      console.warn('[Zequel] System settings not found in database, using defaults')
      return DEFAULT_SETTINGS
    }

    // Convert rows to settings object
    const settings: SystemSettings = { ...DEFAULT_SETTINGS }
    
    for (const row of rows) {
      const key = row.key as keyof SystemSettings
      if (key in settings) {
        // Parse value based on expected type
        const value = row.value
        if (typeof DEFAULT_SETTINGS[key] === 'boolean') {
          settings[key] = (value === 'true' || value === true) as never
        } else if (typeof DEFAULT_SETTINGS[key] === 'number') {
          settings[key] = Number(value) as never
        } else {
          settings[key] = String(value) as never
        }
      }
    }

    // Cache the settings
    cachedSettings = settings
    cacheTimestamp = now

    return settings
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    console.error('[Zequel] Failed to fetch system settings:', errorMessage)
    // Return defaults on any error to prevent crashes
    return DEFAULT_SETTINGS
  }
}

/**
 * Clear settings cache (call after admin updates)
 */
export function clearSettingsCache(): void {
  cachedSettings = null
  cacheTimestamp = 0
}

/**
 * Check if AI is enabled globally
 */
export async function isAIEnabled(): Promise<boolean> {
  const settings = await getSystemSettings()
  return settings.ai_enabled && !settings.maintenance_mode
}

/**
 * Get daily limit based on user plan
 */
export async function getDailyLimit(plan: 'free' | 'premium_lite' | 'premium_pro'): Promise<number> {
  const settings = await getSystemSettings()
  switch (plan) {
    case 'premium_pro':
      return settings.premium_pro_daily_limit
    case 'premium_lite':
      return settings.premium_lite_daily_limit
    default:
      return settings.free_daily_limit
  }
}

/**
 * Get file upload limit based on user plan
 */
export async function getFileUploadLimit(plan: 'free' | 'premium_lite' | 'premium_pro'): Promise<number> {
  const settings = await getSystemSettings()
  switch (plan) {
    case 'premium_pro':
      return settings.max_file_uploads_premium_pro
    case 'premium_lite':
      return settings.max_file_uploads_premium_lite
    default:
      return settings.max_file_uploads_free
  }
}

/**
 * Get max tokens per request
 */
export async function getMaxTokens(): Promise<number> {
  const settings = await getSystemSettings()
  return settings.max_tokens_per_request
}

/**
 * Get default model
 */
export async function getDefaultModel(): Promise<string> {
  const settings = await getSystemSettings()
  return settings.default_model
}

/**
 * Check if file uploads are enabled
 */
export async function isFileUploadsEnabled(): Promise<boolean> {
  const settings = await getSystemSettings()
  return settings.file_uploads_enabled
}

/**
 * Get max file size in bytes
 */
export async function getMaxFileSize(): Promise<number> {
  const settings = await getSystemSettings()
  return settings.max_file_size_mb * 1024 * 1024
}
