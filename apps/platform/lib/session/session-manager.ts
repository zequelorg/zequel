import { createServiceClient } from '@zequel/shared/supabase/service'
import { createClient } from '@zequel/shared/supabase/server'
import { headers } from 'next/headers'
import { UAParser } from 'ua-parser-js'

const MAX_SESSIONS = 3

export interface UserSession {
  id: string
  user_id: string
  session_token: string
  device_name: string | null
  device_type: string | null
  browser: string | null
  os: string | null
  ip_address: string | null
  location: string | null
  is_current: boolean
  created_at: string
  last_active_at: string
  expires_at: string | null
  revoked_at: string | null
  revoked_reason: string | null
}

export interface DeviceInfo {
  device_name: string
  device_type: 'desktop' | 'mobile' | 'tablet' | 'unknown'
  browser: string
  os: string
}

/**
 * Parse user agent to extract device information
 */
export function parseDeviceInfo(userAgent: string): DeviceInfo {
  const parser = new UAParser(userAgent)
  const result = parser.getResult()
  
  const browser = result.browser.name || 'Unknown Browser'
  const os = result.os.name ? `${result.os.name} ${result.os.version || ''}`.trim() : 'Unknown OS'
  
  let deviceType: DeviceInfo['device_type'] = 'desktop'
  if (result.device.type === 'mobile') {
    deviceType = 'mobile'
  } else if (result.device.type === 'tablet') {
    deviceType = 'tablet'
  } else if (result.device.type) {
    deviceType = 'unknown'
  }
  
  const deviceName = result.device.model 
    ? `${result.device.vendor || ''} ${result.device.model}`.trim()
    : `${browser} on ${os}`
  
  return {
    device_name: deviceName,
    device_type: deviceType,
    browser,
    os,
  }
}

/**
 * Get client IP address from request headers
 */
export async function getClientIP(): Promise<string | null> {
  const headersList = await headers()
  // `x-forwarded-for` is a comma-separated list with the original client first.
  // On Vercel `x-vercel-forwarded-for` carries the real client IP and is the
  // most reliable source, so we check it (and the other proxy headers) too.
  const forwarded =
    headersList.get('x-forwarded-for') || headersList.get('x-vercel-forwarded-for')
  const first = forwarded?.split(',')[0]?.trim()
  return (
    first ||
    headersList.get('x-real-ip') ||
    headersList.get('cf-connecting-ip') ||
    null
  )
}

/**
 * Create a new session for a user
 * Enforces the MAX_SESSIONS limit by revoking the oldest session if exceeded
 */
export async function createSession(
  userId: string,
  sessionToken: string,
  userAgent?: string
): Promise<{ success: boolean; session?: UserSession; revokedSession?: UserSession; error?: string }> {
  const supabase = createServiceClient()
  
  // Parse device info
  const deviceInfo = userAgent ? parseDeviceInfo(userAgent) : {
    device_name: 'Unknown Device',
    device_type: 'unknown' as const,
    browser: 'Unknown',
    os: 'Unknown',
  }
  
  const ipAddress = await getClientIP()
  
  // Get active sessions count
  const { data: activeSessions, error: fetchError } = await supabase
    .from('user_sessions')
    .select('*')
    .eq('user_id', userId)
    .is('revoked_at', null)
    .order('created_at', { ascending: true })
  
  if (fetchError) {
    console.error('[Zequel] Failed to fetch active sessions:', fetchError)
    return { success: false, error: 'Failed to check existing sessions' }
  }
  
  let revokedSession: UserSession | undefined
  
  // If at or over limit, revoke the oldest session
  if (activeSessions && activeSessions.length >= MAX_SESSIONS) {
    const oldestSession = activeSessions[0]
    
    const { error: revokeError } = await supabase
      .from('user_sessions')
      .update({
        revoked_at: new Date().toISOString(),
        revoked_reason: 'Session limit exceeded - automatically signed out',
      })
      .eq('id', oldestSession.id)
    
    if (revokeError) {
      console.error('[Zequel] Failed to revoke oldest session:', revokeError)
    } else {
      revokedSession = { ...oldestSession, revoked_at: new Date().toISOString() }
    }
  }
  
  // Create the new session
  const { data: newSession, error: createError } = await supabase
    .from('user_sessions')
    .insert({
      user_id: userId,
      session_token: sessionToken,
      device_name: deviceInfo.device_name,
      device_type: deviceInfo.device_type,
      browser: deviceInfo.browser,
      os: deviceInfo.os,
      ip_address: ipAddress,
      is_current: true,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
    })
    .select()
    .single()
  
  if (createError) {
    console.error('[Zequel] Failed to create session:', createError)
    return { success: false, error: 'Failed to create session' }
  }
  
  return { success: true, session: newSession, revokedSession }
}

/**
 * Get all active sessions for a user
 */
export async function getUserSessions(userId: string): Promise<UserSession[]> {
  const supabase = createServiceClient()
  
  const { data, error } = await supabase
    .from('user_sessions')
    .select('*')
    .eq('user_id', userId)
    .is('revoked_at', null)
    .order('last_active_at', { ascending: false })
  
  if (error) {
    console.error('[Zequel] Failed to fetch user sessions:', error)
    return []
  }
  
  return data || []
}

/**
 * Get sessions for the current authenticated user
 */
export async function getCurrentUserSessions(): Promise<UserSession[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return []
  }
  
  return getUserSessions(user.id)
}

/**
 * Revoke a specific session
 */
export async function revokeSession(
  sessionId: string,
  userId: string,
  reason: string = 'Manually signed out'
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceClient()
  
  const { error } = await supabase
    .from('user_sessions')
    .update({
      revoked_at: new Date().toISOString(),
      revoked_reason: reason,
    })
    .eq('id', sessionId)
    .eq('user_id', userId)
  
  if (error) {
    console.error('[Zequel] Failed to revoke session:', error)
    return { success: false, error: 'Failed to revoke session' }
  }
  
  return { success: true }
}

/**
 * Revoke all sessions except the current one
 */
export async function revokeAllOtherSessions(
  userId: string,
  currentSessionToken: string
): Promise<{ success: boolean; revokedCount: number; error?: string }> {
  const supabase = createServiceClient()
  
  const { data, error } = await supabase
    .from('user_sessions')
    .update({
      revoked_at: new Date().toISOString(),
      revoked_reason: 'Signed out from all devices',
    })
    .eq('user_id', userId)
    .is('revoked_at', null)
    .neq('session_token', currentSessionToken)
    .select()
  
  if (error) {
    console.error('[Zequel] Failed to revoke other sessions:', error)
    return { success: false, revokedCount: 0, error: 'Failed to revoke sessions' }
  }
  
  return { success: true, revokedCount: data?.length || 0 }
}

/**
 * Update session's last active timestamp
 */
export async function updateSessionActivity(sessionToken: string): Promise<void> {
  const supabase = createServiceClient()
  
  await supabase
    .from('user_sessions')
    .update({ last_active_at: new Date().toISOString() })
    .eq('session_token', sessionToken)
    .is('revoked_at', null)
}

/**
 * Check if a session is still valid (not revoked)
 */
export async function isSessionValid(sessionToken: string): Promise<boolean> {
  const supabase = createServiceClient()
  
  const { data, error } = await supabase
    .from('user_sessions')
    .select('id, revoked_at')
    .eq('session_token', sessionToken)
    .single()
  
  if (error || !data) {
    return false
  }
  
  return data.revoked_at === null
}

/**
 * Clean up expired sessions (can be run as a cron job)
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const supabase = createServiceClient()
  
  const { data, error } = await supabase
    .from('user_sessions')
    .update({
      revoked_at: new Date().toISOString(),
      revoked_reason: 'Session expired',
    })
    .lt('expires_at', new Date().toISOString())
    .is('revoked_at', null)
    .select()
  
  if (error) {
    console.error('[Zequel] Failed to cleanup expired sessions:', error)
    return 0
  }
  
  return data?.length || 0
}
