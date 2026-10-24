import { NextResponse } from 'next/server'
import { createClient } from '@zequel/shared/supabase/server'
import { createSession } from '@/lib/session/session-manager'
import { headers } from 'next/headers'

export const dynamic = 'force-dynamic'

/**
 * POST /api/sessions/register - Register a new session after login
 * Called from the client after successful authentication
 */
export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Get the session token
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session?.access_token) {
      return NextResponse.json({ error: 'No active session' }, { status: 400 })
    }
    
    // Get user agent from headers
    const headersList = await headers()
    const userAgent = headersList.get('user-agent') || undefined
    
    // Create session record
    const result = await createSession(user.id, session.access_token, userAgent)
    
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }
    
    return NextResponse.json({ 
      success: true, 
      session: result.session,
      revokedSession: result.revokedSession,
      message: result.revokedSession 
        ? 'Signed in successfully. An older session was signed out due to device limit.'
        : 'Session registered successfully'
    })
  } catch (error) {
    console.error('[Zequel] Session register error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
