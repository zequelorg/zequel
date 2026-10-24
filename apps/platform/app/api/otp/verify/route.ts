import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { createServiceClient } from '@zequel/shared/supabase/service'
import { OTP_PURPOSES, issueOtpToken, normalizeEmail, type OtpPurpose } from '@/lib/security/otp-token'

const MAX_ATTEMPTS = 5
const INVALID = { error: 'Invalid or expired verification code' }

function codesMatch(expected: string, provided: string): boolean {
  const a = Buffer.from(expected)
  const b = Buffer.from(provided)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const email = normalizeEmail(body?.email)
    const purpose = body?.purpose as OtpPurpose
    const code = typeof body?.code === 'string' ? body.code.trim() : ''

    if (!email || !OTP_PURPOSES.includes(purpose) || !/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: 'Email, 6-digit code, and purpose required' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Look up the single active code for this email/purpose, then compare in constant
    // time. Querying by the code itself would let attackers enumerate codes without
    // ever tripping the attempt counter.
    const { data: otp } = await supabase
      .from('otp_codes')
      .select('id, code, expires_at, attempts')
      .eq('email', email)
      .eq('purpose', purpose)
      .eq('used', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!otp || new Date(otp.expires_at) < new Date()) {
      return NextResponse.json(INVALID, { status: 400 })
    }

    const attempts = (otp.attempts ?? 0) as number
    if (attempts >= MAX_ATTEMPTS) {
      await supabase.from('otp_codes').update({ used: true }).eq('id', otp.id)
      return NextResponse.json({ error: 'Too many attempts. Request a new code.' }, { status: 429 })
    }

    if (!codesMatch(otp.code, code)) {
      const next = attempts + 1
      await supabase
        .from('otp_codes')
        .update({ attempts: next, ...(next >= MAX_ATTEMPTS ? { used: true } : {}) })
        .eq('id', otp.id)
      return NextResponse.json(INVALID, { status: 400 })
    }

    const { error: updateError } = await supabase
      .from('otp_codes')
      .update({ used: true })
      .eq('id', otp.id)
      .eq('used', false)

    if (updateError) {
      console.error('[Zequel] Failed to consume OTP:', updateError.message)
      return NextResponse.json({ error: 'Failed to verify code' }, { status: 500 })
    }

    return NextResponse.json({ success: true, token: issueOtpToken(email, purpose, otp.id) })
  } catch (error) {
    console.error('[Zequel] OTP verify error:', error)
    return NextResponse.json({ error: 'Failed to verify code' }, { status: 500 })
  }
}
