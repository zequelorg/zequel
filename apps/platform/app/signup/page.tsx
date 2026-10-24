'use client'

import { createClient } from '@zequel/shared/supabase/client'
import { Button } from '@zequel/ui/components/button'
import { Input } from '@zequel/ui/components/input'
import { OtpVerify } from '@/components/otp-verify'
import { ZequelLogo } from '@zequel/ui/components/zequel-logo'
import { Separator } from '@zequel/ui/components/separator'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function SignUpPage() {
  const [step, setStep] = useState<'form' | 'verify'>('form')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setIsLoading(true)

    try {
      const res = await fetch('/api/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, purpose: 'signup' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send code')
      setStep('verify')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send code')
    } finally {
      setIsLoading(false)
    }
  }

  const handleOtpVerified = async () => {
    const supabase = createClient()

    try {
      // OTP already verified — create account with email pre-confirmed
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/workspace`,
          data: { email_verified: true, otp_verified: true },
        },
      })

      if (signUpError) {
        setError(signUpError.message)
        setStep('form')
        return
      }

      // If signup returns a session, user is automatically confirmed
      if (signUpData?.session) {
        // Register session for device tracking
        try {
          await fetch('/api/sessions/register', { method: 'POST' })
        } catch {
          // Don't block signup if session registration fails
        }
        router.push('/workspace')
        return
      }

      // Otherwise, try to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        // If email not confirmed yet, show success page
        if (signInError.message.includes('email not confirmed')) {
          router.push('/verify-email')
          return
        }
        setError(signInError.message)
        setStep('form')
        return
      }

      // Register session for device tracking
      try {
        await fetch('/api/sessions/register', { method: 'POST' })
      } catch {
        // Don't block signup if session registration fails
      }

      router.push('/workspace')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setStep('form')
    }
  }

  const handleGoogleSignUp = async () => {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/workspace` },
    })
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <ZequelLogo />
          <p className="mt-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Create Account
          </p>
        </div>

        {step === 'form' && (
          <>
            <form onSubmit={handleSendOtp} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Email
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  className="h-10 rounded-md border-border bg-background font-sans text-sm text-foreground placeholder:text-muted-foreground/40"
                  autoComplete="email"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Password
                </label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Min 6 characters"
                  className="h-10 rounded-md border-border bg-background font-sans text-sm text-foreground placeholder:text-muted-foreground/40"
                  autoComplete="new-password"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Confirm Password
                </label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="Confirm password"
                  className="h-10 rounded-md border-border bg-background font-sans text-sm text-foreground placeholder:text-muted-foreground/40"
                  autoComplete="new-password"
                />
              </div>

              {error && (
                <p className="font-mono text-[11px] text-confidence-low">{error}</p>
              )}

              <Button
                type="submit"
                disabled={isLoading}
                className="mt-2 h-10 w-full rounded-md bg-foreground font-mono text-xs uppercase tracking-wider text-background hover:bg-foreground/90"
              >
                {isLoading ? 'Sending code...' : 'Continue'}
              </Button>
            </form>

            <div className="my-6 flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">or</span>
              <Separator className="flex-1" />
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={handleGoogleSignUp}
              className="h-10 w-full rounded-md border-border font-mono text-xs uppercase tracking-wider text-foreground hover:bg-secondary"
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </Button>

            <p className="mt-6 text-center font-mono text-[11px] text-muted-foreground">
              {'Already have an account? '}
              <Link href="/login" className="text-foreground underline underline-offset-4">
                Sign in
              </Link>
            </p>
          </>
        )}

        {step === 'verify' && (
          <OtpVerify
            email={email}
            purpose="signup"
            onVerified={handleOtpVerified}
            onBack={() => setStep('form')}
          />
        )}

        <div className="mt-12 text-center">
          <span className="font-mono text-[10px] tracking-wider text-muted-foreground/40">
            Absalex Labs
          </span>
        </div>
      </div>
    </div>
  )
}
