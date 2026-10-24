'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@zequel/ui/components/button'
import { Separator } from '@zequel/ui/components/separator'
import { 
  Monitor, 
  Smartphone, 
  Tablet, 
  Globe, 
  Clock,
  Loader2,
  LogOut,
  AlertTriangle
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface UserSession {
  id: string
  device_name: string | null
  device_type: string | null
  browser: string | null
  os: string | null
  ip_address: string | null
  location: string | null
  is_current: boolean
  created_at: string
  last_active_at: string
}

interface SessionsPanelProps {
  currentSessionToken?: string
}

const MAX_SESSIONS = 3

function getDeviceIcon(deviceType: string | null) {
  switch (deviceType) {
    case 'mobile':
      return Smartphone
    case 'tablet':
      return Tablet
    case 'desktop':
    default:
      return Monitor
  }
}

export function SessionsPanel({ currentSessionToken }: SessionsPanelProps) {
  const [sessions, setSessions] = useState<UserSession[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRevoking, setIsRevoking] = useState<string | null>(null)
  const [isRevokingAll, setIsRevokingAll] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const fetchSessions = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch('/api/sessions')
      const data = await res.json()
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch sessions')
      }
      
      setSessions(data.sessions || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSessions()
  }, [fetchSessions])

  const handleRevokeSession = async (sessionId: string) => {
    setIsRevoking(sessionId)
    setError(null)
    setSuccessMessage(null)
    
    try {
      const res = await fetch('/api/sessions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      })
      
      const data = await res.json()
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to revoke session')
      }
      
      setSuccessMessage('Session signed out successfully')
      setTimeout(() => setSuccessMessage(null), 3000)
      fetchSessions()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke session')
    } finally {
      setIsRevoking(null)
    }
  }

  const handleRevokeAllOther = async () => {
    setIsRevokingAll(true)
    setError(null)
    setSuccessMessage(null)
    
    try {
      const res = await fetch('/api/sessions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revokeAll: true }),
      })
      
      const data = await res.json()
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to revoke sessions')
      }
      
      setSuccessMessage(data.message || 'Signed out from all other devices')
      setTimeout(() => setSuccessMessage(null), 3000)
      fetchSessions()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke sessions')
    } finally {
      setIsRevokingAll(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <p className="mt-3 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          Loading sessions...
        </p>
      </div>
    )
  }

  const currentSession = sessions.find(s => s.is_current)
  const otherSessions = sessions.filter(s => !s.is_current)

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div>
        <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          Active Sessions
        </p>
        <p className="mt-0.5 font-sans text-[12px] text-muted-foreground/70">
          Manage devices where you&apos;re signed in. Maximum {MAX_SESSIONS} devices allowed.
        </p>
      </div>

      {/* Session limit indicator */}
      <div className="flex items-center gap-3 rounded-lg border border-border bg-secondary/20 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary">
          <Globe className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1">
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            Device Limit
          </p>
          <p className="font-mono text-sm text-foreground">
            {sessions.length} / {MAX_SESSIONS} devices
          </p>
        </div>
        {sessions.length >= MAX_SESSIONS && (
          <div className="flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2 py-1">
            <AlertTriangle className="h-3 w-3 text-amber-500" />
            <span className="font-mono text-[10px] uppercase tracking-wider text-amber-500">
              Limit reached
            </span>
          </div>
        )}
      </div>

      {/* Messages */}
      {error && (
        <div className="rounded-md bg-destructive/10 px-3 py-2">
          <p className="font-mono text-[11px] text-destructive">{error}</p>
        </div>
      )}
      
      {successMessage && (
        <div className="rounded-md bg-emerald-500/10 px-3 py-2">
          <p className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400">{successMessage}</p>
        </div>
      )}

      <Separator />

      {/* Current Session */}
      {currentSession && (
        <>
          <div>
            <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Current Session
            </p>
            <SessionCard session={currentSession} isCurrent />
          </div>
          <Separator />
        </>
      )}

      {/* Other Sessions */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Other Devices ({otherSessions.length})
          </p>
          {otherSessions.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRevokeAllOther}
              disabled={isRevokingAll}
              className="h-7 font-mono text-[10px] uppercase tracking-wider text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              {isRevokingAll ? (
                <>
                  <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                  Signing out...
                </>
              ) : (
                <>
                  <LogOut className="mr-1.5 h-3 w-3" />
                  Sign out all
                </>
              )}
            </Button>
          )}
        </div>

        {otherSessions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-secondary/10 px-4 py-8 text-center">
            <Monitor className="mx-auto h-8 w-8 text-muted-foreground/40" />
            <p className="mt-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              No other active sessions
            </p>
            <p className="mt-1 font-sans text-[12px] text-muted-foreground/60">
              You&apos;re only signed in on this device
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {otherSessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                onRevoke={() => handleRevokeSession(session.id)}
                isRevoking={isRevoking === session.id}
              />
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* Security note */}
      <div className="rounded-lg border border-border bg-secondary/10 px-4 py-3">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Security Note
        </p>
        <p className="mt-1 font-sans text-[12px] leading-relaxed text-muted-foreground/70">
          If you sign in on a new device when all {MAX_SESSIONS} slots are used, the oldest session 
          will be automatically signed out to make room.
        </p>
      </div>
    </div>
  )
}

interface SessionCardProps {
  session: UserSession
  isCurrent?: boolean
  onRevoke?: () => void
  isRevoking?: boolean
}

function SessionCard({ session, isCurrent, onRevoke, isRevoking }: SessionCardProps) {
  const DeviceIcon = getDeviceIcon(session.device_type)
  const lastActive = session.last_active_at 
    ? formatDistanceToNow(new Date(session.last_active_at), { addSuffix: true })
    : 'Unknown'
  
  return (
    <div className={`flex items-center gap-4 rounded-lg border px-4 py-3 ${
      isCurrent 
        ? 'border-primary/30 bg-primary/5' 
        : 'border-border bg-secondary/10'
    }`}>
      <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
        isCurrent ? 'bg-primary/10' : 'bg-secondary'
      }`}>
        <DeviceIcon className={`h-5 w-5 ${isCurrent ? 'text-primary' : 'text-muted-foreground'}`} />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate font-sans text-sm font-medium text-foreground">
            {session.device_name || 'Unknown Device'}
          </p>
          {isCurrent && (
            <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-primary">
              This device
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-muted-foreground">
          <span className="truncate font-mono text-[11px]">
            {session.browser || 'Unknown'} • {session.os || 'Unknown'}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-1 text-muted-foreground/60">
          <Clock className="h-3 w-3" />
          <span className="font-mono text-[10px]">
            {isCurrent ? 'Active now' : `Last active ${lastActive}`}
          </span>
          {session.ip_address && (
            <>
              <span className="mx-1">•</span>
              <span className="font-mono text-[10px]">{session.ip_address}</span>
            </>
          )}
        </div>
      </div>

      {!isCurrent && onRevoke && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onRevoke}
          disabled={isRevoking}
          className="shrink-0 h-8 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          {isRevoking ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <LogOut className="h-3.5 w-3.5" />
          )}
        </Button>
      )}
    </div>
  )
}
