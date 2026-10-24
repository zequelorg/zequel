import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@zequel/shared/supabase/server'
import { createServiceClient } from '@zequel/shared/supabase/service'

/**
 * Permanently deletes the signed-in user's account after verifying the
 * emailed OTP (purpose: 'delete_account'). Deleting the auth user cascades
 * to all owned rows via ON DELETE CASCADE foreign keys.
 */
export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json()

    if (!code) {
      return NextResponse.json({ error: 'Verification code required' }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user || !user.email) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const service = createServiceClient()
    const email = user.email.toLowerCase()

    // Verify a valid, unused, unexpired delete_account code
    const { data: otp, error: otpError } = await service
      .from('otp_codes')
      .select('id, expires_at')
      .eq('email', email)
      .eq('code', code)
      .eq('purpose', 'delete_account')
      .eq('used', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (otpError || !otp) {
      return NextResponse.json({ error: 'Invalid or expired verification code' }, { status: 400 })
    }

    if (new Date(otp.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Code has expired' }, { status: 400 })
    }

    // Mark the code used so it can't be replayed
    await service.from('otp_codes').update({ used: true }).eq('id', otp.id)

    // Permanently delete the auth user (cascades all owned rows)
    const { error: deleteError } = await service.auth.admin.deleteUser(user.id)

    if (deleteError) {
      console.error('[Zequel] Account deletion error:', deleteError)
      return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 })
    }

    // Sign out the local session
    await supabase.auth.signOut()

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Zequel] Delete account error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete account' },
      { status: 500 }
    )
  }
}
