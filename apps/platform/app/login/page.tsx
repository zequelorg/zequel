'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@zequel/shared/supabase/client'
import { ZequelLogo } from '@zequel/ui/components/zequel-logo'
import { OtpVerify } from '@/components/otp-verify'
import { Input } from '@zequel/ui/components/input'
import { Button } from '@zequel/ui/components/button'
import { Separator } from '@zequel/ui/components/separator'
import Link from 'next/link'

type View = 'login' | 'forgot' | 'forgot_otp' | 'new_password'

export default function LoginPage() {
  const router = useRouter()
  const [view, setView] = useState<View>('login')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const [resetEmail, setResetEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [resetError, setResetError] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [isSendingReset, setIsSendingReset] = useState(false)
  const [isResetting, setIsResetting] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    try {
      const supabase = createClient()
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) {
        if (signInError.message.includes('Email not confirmed')) {
          setError('Please verify your email first. Check your inbox for the verification code.')
          return
        }
        throw signInError
      }
      
      // Register session for device tracking
      try {
        await fetch('/api/sessions/register', { method: 'POST' })
      } catch {
        // Don't block login if session registration fails
        console.warn('Failed to register session')
      }
      
      router.push('/workspace')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to sign in')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSendResetOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setResetError('')
    setIsSendingReset(true)
    try {
      const res = await fetch('/api/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail, purpose: 'reset_password' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send code')
      setView('forgot_otp')
    } catch (err: unknown) {
      setResetError(err instanceof Error ? err.message : 'Failed to send code')
    } finally {
      setIsSendingReset(false)
    }
  }

  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setResetError('')
    if (newPassword.length < 8) { setResetError('Password must be at least 8 characters'); return }
    if (newPassword !== confirmNewPassword) { setResetError('Passwords do not match'); return }
    setIsResetting(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail, newPassword, verificationToken: resetToken }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to reset password')
      const supabase = createClient()
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: resetEmail, password: newPassword })
      if (signInError) {
        setView('login')
        setEmail(resetEmail)
        setError('Password reset successfully. Please sign in.')
      } else {
        // Register session for device tracking
        try {
          await fetch('/api/sessions/register', { method: 'POST' })
        } catch {
          // Don't block login if session registration fails
        }
        router.push('/workspace')
      }
    } catch (err: unknown) {
      setResetError(err instanceof Error ? err.message : 'Failed to reset password')
    } finally {
      setIsResetting(false)
    }
  }

  const handleGoogleLogin = async () => {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/workspace` },
    })
  }

  // --- Forgot: enter email ---
  if (view === 'forgot') {
    return (
      <Shell subtitle="Reset Password">
        <form onSubmit={handleSendResetOtp} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Email</label>
            <Input type="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} required placeholder="you@example.com" className="h-10 rounded-md border-border bg-background font-sans text-sm text-foreground placeholder:text-muted-foreground/40" autoComplete="email" />
          </div>
          <p className="font-sans text-[12px] leading-relaxed text-muted-foreground">{"We'll send a 6-digit verification code to your email."}</p>
          {resetError && <p className="font-mono text-[11px] text-confidence-low">{resetError}</p>}
          <Button type="submit" disabled={isSendingReset} className="mt-2 h-10 w-full rounded-md bg-foreground font-mono text-xs uppercase tracking-wider text-background hover:bg-foreground/90">
            {isSendingReset ? 'Sending code...' : 'Send Code'}
          </Button>
        </form>
        <p className="mt-6 text-center">
          <button type="button" onClick={() => { setView('login'); setResetError('') }} className="font-mono text-[11px] text-muted-foreground underline underline-offset-4 hover:text-foreground">Back to sign in</button>
        </p>
      </Shell>
    )
  }

  // --- Forgot: verify OTP ---
  if (view === 'forgot_otp') {
    return (
      <Shell subtitle="Reset Password">
        <OtpVerify
          email={resetEmail}
          purpose="reset_password"
          onVerified={(token) => {
            setResetToken(token)
            setView('new_password')
          }}
          onBack={() => setView('forgot')}
        />
      </Shell>
    )
  }

  // --- Forgot: set new password ---
  if (view === 'new_password') {
    return (
      <Shell subtitle="New Password">
        <form onSubmit={handleSetNewPassword} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">New Password</label>
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required placeholder="Min 6 characters" className="h-10 rounded-md border-border bg-background font-sans text-sm text-foreground placeholder:text-muted-foreground/40" autoComplete="new-password" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Confirm Password</label>
            <Input type="password" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} required placeholder="Confirm password" className="h-10 rounded-md border-border bg-background font-sans text-sm text-foreground placeholder:text-muted-foreground/40" autoComplete="new-password" />
          </div>
          {resetError && <p className="font-mono text-[11px] text-confidence-low">{resetError}</p>}
          <Button type="submit" disabled={isResetting} className="mt-2 h-10 w-full rounded-md bg-foreground font-mono text-xs uppercase tracking-wider text-background hover:bg-foreground/90">
            {isResetting ? 'Resetting...' : 'Reset Password'}
          </Button>
        </form>
      </Shell>
    )
  }

  // --- Default: Login ---
  return (
    <Shell subtitle="Sign In">
      <form onSubmit={handleLogin} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Email</label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" className="h-10 rounded-md border-border bg-background font-sans text-sm text-foreground placeholder:text-muted-foreground/40" autoComplete="email" />
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Password</label>
            <button type="button" onClick={() => { setView('forgot'); setResetEmail(email); setResetError('') }} className="font-mono text-[10px] text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground">Forgot?</button>
          </div>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="h-10 rounded-md border-border bg-background font-sans text-sm text-foreground placeholder:text-muted-foreground/40" autoComplete="current-password" />
        </div>
        {error && <p className="font-mono text-[11px] text-confidence-low">{error}</p>}
        <Button type="submit" disabled={isLoading} className="mt-2 h-10 w-full rounded-md bg-foreground font-mono text-xs uppercase tracking-wider text-background hover:bg-foreground/90">
          {isLoading ? 'Signing in...' : 'Sign In'}
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">or</span>
        <Separator className="flex-1" />
      </div>

      <Button type="button" variant="outline" onClick={handleGoogleLogin} className="h-10 w-full rounded-md border-border font-mono text-xs uppercase tracking-wider text-foreground hover:bg-secondary">
        <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        Continue with Google
      </Button>

      <p className="mt-6 text-center font-mono text-[11px] text-muted-foreground">
        {"Don't have an account? "}
        <Link href="/signup" className="text-foreground underline underline-offset-4">Create one</Link>
      </p>
    </Shell>
  )
}

function Shell({ subtitle, children }: { subtitle: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh w-full items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <ZequelLogo />
          <p className="mt-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{subtitle}</p>
        </div>
        {children}
        <div className="mt-12 text-center">
          <span className="font-mono text-[10px] tracking-wider text-muted-foreground/40">Absalex Labs</span>
        </div>
      </div>
    </div>
  )
}
