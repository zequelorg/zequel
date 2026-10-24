import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@zequel/shared/supabase/server'
import { createSession } from '@/lib/session/session-manager'
import { headers } from 'next/headers'

/**
 * Auth callback route for handling email confirmation and OAuth redirects
 * This is required for email confirmation links and OAuth provider callbacks
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  // Handle OAuth errors
  if (error) {
    console.error('[Zequel] Auth error:', error, errorDescription)
    return NextResponse.redirect(
      new URL(
        `/auth/error?error=${encodeURIComponent(error)}&description=${encodeURIComponent(errorDescription || '')}`,
        request.url,
      ),
    )
  }

  // Handle email confirmation and OAuth code exchange
  if (code) {
    try {
      const supabase = await createClient()
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

      if (exchangeError) {
        console.error('[Zequel] Code exchange error:', exchangeError)
        return NextResponse.redirect(
          new URL(
            `/auth/error?error=${encodeURIComponent(exchangeError.message)}`,
            request.url,
          ),
        )
      }

      // Register session for device tracking
      try {
        const { data: { user } } = await supabase.auth.getUser()
        const { data: { session } } = await supabase.auth.getSession()
        
        if (user && session?.access_token) {
          const headersList = await headers()
          const userAgent = headersList.get('user-agent') || undefined
          await createSession(user.id, session.access_token, userAgent)
        }
      } catch (sessionError) {
        // Don't block OAuth flow if session registration fails
        console.warn('[Zequel] Session registration failed:', sessionError)
      }

      // Successfully authenticated, redirect to workspace
      return NextResponse.redirect(new URL('/workspace', request.url))
    } catch (err) {
      console.error('[Zequel] Auth callback error:', err)
      return NextResponse.redirect(
        new URL(
          `/auth/error?error=Authentication+failed`,
          request.url,
        ),
      )
    }
  }

  // No code or error provided
  console.warn('[Zequel] Auth callback called without code or error')
  return NextResponse.redirect(new URL('/login', request.url))
}
