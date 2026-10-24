'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@zequel/shared/supabase/client'
import { SplashScreen } from '@/components/splash-screen'

export default function RootPage() {
  const router = useRouter()
  const [destination, setDestination] = useState<string | null>(null)
  const [splashDone, setSplashDone] = useState(false)
  const [showContent, setShowContent] = useState(false)

  useEffect(() => {
    async function checkAuth() {
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        setDestination(user ? '/workspace' : '/login')
      } catch (error) {
        console.error('[Zequel] Auth check failed:', error)
        // Default to login page if auth fails
        setDestination('/login')
      }
    }
    checkAuth()
  }, [])

  const handleSplashComplete = useCallback(() => {
    setSplashDone(true)
  }, [])

  useEffect(() => {
    if (splashDone && destination) {
      // Brief delay then navigate so the splash fully fades
      const t = setTimeout(() => {
        setShowContent(true)
        router.replace(destination)
      }, 100)
      return () => clearTimeout(t)
    }
  }, [splashDone, destination, router])

  return (
    <>
      {!splashDone && <SplashScreen onComplete={handleSplashComplete} />}
      {/* Overlay that fades away after navigation begins */}
      <div
        className="fixed inset-0 z-40 bg-background"
        style={{
          opacity: showContent ? 0 : 1,
          transition: 'opacity 0.6s ease-in-out',
          pointerEvents: showContent ? 'none' : 'auto',
        }}
      />
    </>
  )
}
