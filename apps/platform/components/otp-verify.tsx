'use client'

import { useState } from 'react'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@zequel/ui/components/input-otp'
import { Button } from '@zequel/ui/components/button'

interface OtpVerifyProps {
  email: string
  purpose: 'signup' | 'reset_password' | 'change_password' | 'delete_account'
  onVerified: (verificationToken: string) => void
  onBack?: () => void
}

export function OtpVerify({ email, purpose, onVerified, onBack }: OtpVerifyProps) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

  const handleVerify = async () => {
    if (code.length !== 6) {
      setError('Enter the full 6-digit code')
      return
    }

    setIsVerifying(true)
    setError('')

    try {
      const res = await fetch('/api/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, purpose }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Invalid code')
        setIsVerifying(false)
        return
      }

      onVerified(typeof data.token === 'string' ? data.token : '')
    } catch {
      setError('Verification failed')
      setIsVerifying(false)
    }
  }

  const handleResend = async () => {
    if (resendCooldown > 0) return
    setIsResending(true)
    setError('')

    try {
      const res = await fetch('/api/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, purpose }),
      })

      if (res.ok) {
        setResendCooldown(60)
        const interval = setInterval(() => {
          setResendCooldown((prev) => {
            if (prev <= 1) {
              clearInterval(interval)
              return 0
            }
            return prev - 1
          })
        }, 1000)
      }
    } catch {
      setError('Failed to resend')
    } finally {
      setIsResending(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Verification
        </p>
        <p className="mt-2 font-sans text-sm text-muted-foreground">
          {'Enter the 6-digit code sent to '}
          <span className="font-medium text-foreground">{email}</span>
        </p>
      </div>

      <div className="flex justify-center">
        <InputOTP
          maxLength={6}
          value={code}
          onChange={(value) => {
            setCode(value)
          }}
        >
          <InputOTPGroup>
            <InputOTPSlot index={0} className="h-12 w-11 border-border bg-background font-mono text-lg font-bold text-foreground" />
            <InputOTPSlot index={1} className="h-12 w-11 border-border bg-background font-mono text-lg font-bold text-foreground" />
            <InputOTPSlot index={2} className="h-12 w-11 border-border bg-background font-mono text-lg font-bold text-foreground" />
            <InputOTPSlot index={3} className="h-12 w-11 border-border bg-background font-mono text-lg font-bold text-foreground" />
            <InputOTPSlot index={4} className="h-12 w-11 border-border bg-background font-mono text-lg font-bold text-foreground" />
            <InputOTPSlot index={5} className="h-12 w-11 border-border bg-background font-mono text-lg font-bold text-foreground" />
          </InputOTPGroup>
        </InputOTP>
      </div>

      {error && (
        <p className="text-center font-mono text-[11px] text-confidence-low">{error}</p>
      )}

      <Button
        onClick={handleVerify}
        disabled={isVerifying || code.length !== 6}
        className="h-10 w-full rounded-md bg-foreground font-mono text-xs uppercase tracking-wider text-background hover:bg-foreground/90 disabled:opacity-40"
      >
        {isVerifying ? 'Verifying...' : 'Verify'}
      </Button>

      <div className="flex items-center justify-between">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="font-mono text-[11px] text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
          >
            Back
          </button>
        )}
        <button
          type="button"
          onClick={handleResend}
          disabled={isResending || resendCooldown > 0}
          className="ml-auto font-mono text-[11px] text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground disabled:no-underline disabled:opacity-50"
        >
          {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : isResending ? 'Sending...' : 'Resend code'}
        </button>
      </div>
    </div>
  )
}
