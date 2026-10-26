import { useEffect, useState } from 'react'

type Status = 'checking' | 'connected' | 'unreachable'

const POLL_INTERVAL_MS = 2000

/**
 * Polls the real Go backend through window.zequel.backend.health() — not a
 * mock. Polling never stops: the backend is started in parallel with window
 * creation (see main.ts), so early failures while it's still starting up are
 * expected, not an error — but this keeps checking indefinitely rather than
 * giving up after N attempts, specifically so the indicator stays truthful if
 * the backend starts late, or — more importantly — if it was connected and
 * then crashes or is killed later in the session. An earlier version of this
 * component stopped polling after 10 failures, which meant the UI could keep
 * showing "connected" forever after an unexpected backend exit. It no longer
 * does that.
 */
export function BackendStatus() {
  const [status, setStatus] = useState<Status>('checking')
  const [version, setVersion] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>

    const poll = async () => {
      try {
        const health = await window.zequel.backend.health()
        if (cancelled) return
        setStatus('connected')
        setVersion(health.version)
      } catch {
        if (cancelled) return
        setStatus('unreachable')
        setVersion(null)
      } finally {
        if (!cancelled) {
          timer = setTimeout(() => void poll(), POLL_INTERVAL_MS)
        }
      }
    }

    void poll()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [])

  const label =
    status === 'connected'
      ? `Backend v${version}`
      : status === 'checking'
        ? 'Connecting to backend…'
        : 'Backend unreachable'

  return (
    <span className={`backend-status backend-status--${status}`}>
      <span className="backend-status-dot" />
      {label}
    </span>
  )
}
