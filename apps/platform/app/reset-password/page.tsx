'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ZequelLogo } from '@zequel/ui/components/zequel-logo'

export default function ResetPasswordPage() {
  const router = useRouter()

  useEffect(() => {
    // Password reset is now handled via OTP in the login page
    router.replace('/login')
  }, [router])

  return (
    <div className="flex min-h-svh w-full items-center justify-center bg-background p-6">
      <div className="text-center">
        <ZequelLogo />
        <p className="mt-4 font-mono text-[11px] text-muted-foreground">Redirecting...</p>
      </div>
    </div>
  )
}
