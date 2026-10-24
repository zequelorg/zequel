import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@zequel/shared/supabase/service'
import { normalizeEmail, verifyOtpToken } from '@/lib/security/otp-token'

const MIN_PASSWORD_LENGTH = 8
const MAX_PASSWORD_LENGTH = 72

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const email = normalizeEmail(body?.email)
    const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : ''

    if (!email || !newPassword) {
      return NextResponse.json({ error: 'Email and new password required' }, { status: 400 })
    }

    if (newPassword.length < MIN_PASSWORD_LENGTH || newPassword.length > MAX_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `Password must be ${MIN_PASSWORD_LENGTH}-${MAX_PASSWORD_LENGTH} characters` },
        { status: 400 },
      )
    }

    // Proof that this caller completed OTP verification for this exact email.
    if (!verifyOtpToken(body?.verificationToken, email, 'reset_password')) {
      return NextResponse.json({ error: 'Verification expired. Please request a new code.' }, { status: 401 })
    }

    const supabase = createServiceClient()
    const { data: userId, error: lookupError } = await supabase.rpc('auth_user_id_by_email', {
      lookup_email: email,
    })

    if (lookupError) {
      console.error('[Zequel] User lookup error:', lookupError.message)
      return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 })
    }

    if (!userId) {
      return NextResponse.json({ error: 'Verification expired. Please request a new code.' }, { status: 401 })
    }

    const { error: updateError } = await supabase.auth.admin.updateUserById(userId as string, {
      password: newPassword,
    })

    if (updateError) {
      console.error('[Zequel] Password update error:', updateError.message)
      return NextResponse.json({ error: 'Failed to update password' }, { status: 500 })
    }

    // Revoke every existing session so an attacker holding a stolen session is logged out.
    await supabase.auth.admin.signOut(userId as string, 'global').catch(() => undefined)
    await supabase
      .from('user_sessions')
      .update({ revoked_at: new Date().toISOString(), revoked_reason: 'password_reset' })
      .eq('user_id', userId)
      .is('revoked_at', null)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Zequel] Reset password error:', error)
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 })
  }
}
