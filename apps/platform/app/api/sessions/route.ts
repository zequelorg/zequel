import { NextResponse } from 'next/server'
import { createClient } from '@zequel/shared/supabase/server'
import { getUserSessions, revokeSession, revokeAllOtherSessions } from '@/lib/session/session-manager'

export const dynamic = 'force-dynamic'

/**
 * GET /api/sessions - Get all active sessions for the current user
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Get current session token to mark which session is "current"
    const { data: { session } } = await supabase.auth.getSession()
    const currentToken = session?.access_token
    
    const sessions = await getUserSessions(user.id)
    
    // Mark the current session
    const sessionsWithCurrent = sessions.map(s => ({
      ...s,
      is_current: s.session_token === currentToken,
    }))
    
    return NextResponse.json({ sessions: sessionsWithCurrent })
  } catch (error) {
    console.error('[Zequel] Sessions GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/sessions - Revoke a specific session or all other sessions
 */
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const { sessionId, revokeAll } = await request.json()
    
    // Get current session token
    const { data: { session } } = await supabase.auth.getSession()
    const currentToken = session?.access_token
    
    if (revokeAll && currentToken) {
      // Revoke all other sessions
      const result = await revokeAllOtherSessions(user.id, currentToken)
      
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 500 })
      }
      
      return NextResponse.json({ 
        success: true, 
        message: `Signed out from ${result.revokedCount} other device(s)` 
      })
    }
    
    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 })
    }
    
    // Revoke specific session
    const result = await revokeSession(sessionId, user.id)
    
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }
    
    return NextResponse.json({ success: true, message: 'Session revoked successfully' })
  } catch (error) {
    console.error('[Zequel] Sessions DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
