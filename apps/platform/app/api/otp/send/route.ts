import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createServiceClient } from '@zequel/shared/supabase/service'
import { generateOtp, otpEmailHtml } from '@/lib/otp'
import { OTP_PURPOSES, normalizeEmail, type OtpPurpose } from '@/lib/security/otp-token'

const RESEND_COOLDOWN_MS = 60 * 1000
const MAX_CODES_PER_HOUR = 6

const SUBJECTS: Record<OtpPurpose, string> = {
  signup: 'Verify your Zequel account',
  reset_password: 'Reset your Zequel password',
  change_password: 'Confirm your password change',
  delete_account: 'Confirm your Zequel account deletion',
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const email = normalizeEmail(body?.email)
    const purpose = body?.purpose as OtpPurpose

    if (!email || !OTP_PURPOSES.includes(purpose)) {
      return NextResponse.json({ error: 'A valid email and purpose are required' }, { status: 400 })
    }

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: 'Email service is not configured' }, { status: 503 })
    }

    const supabase = createServiceClient()

    // Server-side throttling: the client cooldown alone can be bypassed trivially,
    // which would allow email bombing and cost abuse on the email provider.
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { data: recent } = await supabase
      .from('otp_codes')
      .select('created_at')
      .eq('email', email)
      .gte('created_at', hourAgo)
      .order('created_at', { ascending: false })

    if (recent && recent.length > 0) {
      const lastSentAt = new Date(recent[0].created_at).getTime()
      if (Date.now() - lastSentAt < RESEND_COOLDOWN_MS || recent.length >= MAX_CODES_PER_HOUR) {
        return NextResponse.json(
          { error: 'Too many codes requested. Please wait a moment and try again.' },
          { status: 429 },
        )
      }
    }

    // Password reset must not reveal whether an account exists.
    if (purpose === 'reset_password' || purpose === 'change_password' || purpose === 'delete_account') {
      const { data: exists } = await supabase.rpc('auth_email_exists', { lookup_email: email })
      if (exists === false) {
        return NextResponse.json({ success: true })
      }
    }

    await supabase
      .from('otp_codes')
      .update({ used: true })
      .eq('email', email)
      .eq('purpose', purpose)
      .eq('used', false)

    const code = generateOtp()
    const { error: insertError } = await supabase.from('otp_codes').insert({
      email,
      code,
      purpose,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    })

    if (insertError) {
      console.error('[Zequel] OTP insert error:', insertError.message)
      return NextResponse.json({ error: 'Failed to generate code' }, { status: 500 })
    }

    const { error: sendError } = await new Resend(process.env.RESEND_API_KEY).emails.send({
      from: 'Zequel <noreply@zequel.xyz>',
      to: email,
      subject: SUBJECTS[purpose],
      html: otpEmailHtml({ code, purpose }),
    })

    if (sendError) {
      console.error('[Zequel] Resend error:', sendError)
      return NextResponse.json({ error: 'Failed to send email' }, { status: 502 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Zequel] OTP send error:', error)
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 })
  }
}
