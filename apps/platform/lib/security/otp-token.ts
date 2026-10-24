import 'server-only'
import { createHmac, timingSafeEqual } from 'crypto'

export type OtpPurpose = 'signup' | 'reset_password' | 'change_password' | 'delete_account'

export const OTP_PURPOSES: readonly OtpPurpose[] = ['signup', 'reset_password', 'change_password', 'delete_account']

const TOKEN_TTL_MS = 10 * 60 * 1000

function getSecret(): string {
  const secret = process.env.OTP_TOKEN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) throw new Error('OTP_TOKEN_SECRET_MISSING')
  // Domain-separate so the raw service key is never used directly as an HMAC key for this purpose.
  return createHmac('sha256', secret).update('zequel-otp-verification-v1').digest('hex')
}

function sign(payload: string): string {
  return createHmac('sha256', getSecret()).update(payload).digest('base64url')
}

/**
 * Issues a short-lived proof that `email` completed OTP verification for `purpose`.
 * Server routes that perform the privileged action must require and verify this token,
 * otherwise the OTP step can be skipped by calling the action endpoint directly.
 */
export function issueOtpToken(email: string, purpose: OtpPurpose, otpId: string): string {
  const payload = Buffer.from(
    JSON.stringify({ e: email.toLowerCase(), p: purpose, i: otpId, x: Date.now() + TOKEN_TTL_MS }),
  ).toString('base64url')
  return `${payload}.${sign(payload)}`
}

export function verifyOtpToken(token: unknown, email: string, purpose: OtpPurpose): { otpId: string } | null {
  if (typeof token !== 'string' || !token.includes('.')) return null
  const [payload, signature] = token.split('.', 2)
  const expected = Buffer.from(sign(payload))
  const provided = Buffer.from(signature)
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) return null

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      e: string
      p: string
      i: string
      x: number
    }
    if (data.e !== email.toLowerCase() || data.p !== purpose || Date.now() > data.x) return null
    return { otpId: data.i }
  } catch {
    return null
  }
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const email = value.trim().toLowerCase()
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) return null
  return email
}
