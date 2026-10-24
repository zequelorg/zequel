import { useEffect, useState } from 'react'

type Status = 'checking' | 'connected' | 'unreachable'

const POLL_INTERVAL_MS = 1500
const MAX_ATTEMPTS = 10

/**
 * Polls the real Go backend through window.zequel.backend.health() — not a
 * mock. The backend is started in parallel with window creation (see
 * main.ts), so the first few attempts failing while it finishes starting up
 * is expected, not an error state; only report "unreachable" after
 * MAX_ATTEMPTS genuinely fail.
 */
export function BackendStatus() {
  const [status, setStatus] = useState<Status>('checking')
  const [version, setVersion] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let attempts = 0

    const poll = async () => {
      try {
        const health = await window.zequel.backend.health()
        if (cancelled) return
        setStatus('connected')
        setVersion(health.version)
        return
      } catch {
        attempts += 1
        if (cancelled) return
        if (attempts >= MAX_ATTEMPTS) {
          setStatus('unreachable')
          return
        }
        setTimeout(() => void poll(), POLL_INTERVAL_MS)
      }
    }

    void poll()
    return () => {
      cancelled = true
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
