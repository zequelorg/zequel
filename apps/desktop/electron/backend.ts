import { spawn, type ChildProcess } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import path from 'node:path'

/**
 * Owns the lifecycle of the Go backend process (zequeld).
 *
 * The renderer never talks to this process or knows its token — only this
 * module and main.ts (which calls backendFetch() from inside IPC handlers)
 * ever see it. See docs/SECURITY.md and backend/api/API.md for the full
 * picture of why the boundary is shaped this way.
 *
 * NOTE on packaged builds: this currently only knows how to find the Go
 * binary in a local dev checkout (backend/bin/zequeld, built by hand — see
 * backend/README.md). Resolving the binary inside a packaged .app/.exe via
 * electron-builder `extraResources` is not implemented yet; that's tracked in
 * docs/STATUS.md, not silently assumed to work.
 */

let child: ChildProcess | null = null
let backendPort: number | null = null
let backendToken: string | null = null

function resolveBackendBinaryPath(): string {
  const binaryName = process.platform === 'win32' ? 'zequeld.exe' : 'zequeld'
  // Dev-mode only for now (see NOTE above). Repo root is three levels up
  // from apps/desktop/electron/ at runtime (dist-electron/backend.js).
  return path.resolve(__dirname, '../../../backend/bin', binaryName)
}

const PORT_LINE_PREFIX = 'ZEQUEL_BACKEND_PORT='
const STARTUP_TIMEOUT_MS = 10_000

export interface BackendHandle {
  port: number
  token: string
}

export function startBackend(): Promise<BackendHandle> {
  return new Promise((resolve, reject) => {
    const binaryPath = resolveBackendBinaryPath()
    if (!existsSync(binaryPath)) {
      reject(
        new Error(
          `Backend binary not found at ${binaryPath}. Build it first: ` +
            `cd backend && go build -o bin/zequeld ./cmd/zequeld (see backend/README.md).`
        )
      )
      return
    }

    const token = randomBytes(32).toString('hex')

    const proc = spawn(binaryPath, [], {
      env: { ...process.env, ZEQUEL_BACKEND_TOKEN: token },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    child = proc

    const timeout = setTimeout(() => {
      proc.kill()
      reject(new Error(`Backend did not report a port within ${STARTUP_TIMEOUT_MS}ms`))
    }, STARTUP_TIMEOUT_MS)

    let stdoutBuffer = ''
    proc.stdout?.on('data', (chunk: Buffer) => {
      stdoutBuffer += chunk.toString('utf-8')
      const line = stdoutBuffer.split('\n').find((l) => l.startsWith(PORT_LINE_PREFIX))
      if (line) {
        const port = Number(line.slice(PORT_LINE_PREFIX.length).trim())
        if (Number.isInteger(port) && port > 0) {
          clearTimeout(timeout)
          backendPort = port
          backendToken = token
          resolve({ port, token })
        }
      }
    })

    proc.stderr?.on('data', (chunk: Buffer) => {
      // Backend logs (startup errors, shutdown messages) — surfaced to the
      // app's own log, never to the renderer.
      console.error('[zequeld]', chunk.toString('utf-8').trim())
    })

    proc.on('exit', (code, signal) => {
      child = null
      backendPort = null
      backendToken = null
      if (code !== 0 && code !== null) {
        console.error(`[zequeld] exited with code ${code} (signal: ${signal})`)
      }
    })

    proc.on('error', (err) => {
      clearTimeout(timeout)
      reject(err)
    })
  })
}

export async function stopBackend(): Promise<void> {
  if (!child) return
  const proc = child
  await new Promise<void>((resolve) => {
    const forceKillTimer = setTimeout(() => {
      proc.kill('SIGKILL')
    }, 5_000)
    proc.once('exit', () => {
      clearTimeout(forceKillTimer)
      resolve()
    })
    proc.kill('SIGTERM')
  })
}

/**
 * The only way anything in main.ts talks to the Go backend. Not exported to
 * the renderer in any form — IPC handlers call this server-side and return
 * only the parsed, specific result the renderer asked for.
 */
export async function backendFetch(urlPath: string, init?: RequestInit): Promise<unknown> {
  if (!backendPort || !backendToken) {
    throw new Error('Backend is not running.')
  }
  const res = await fetch(`http://127.0.0.1:${backendPort}${urlPath}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${backendToken}`,
    },
  })
  if (!res.ok) {
    throw new Error(`Backend request to ${urlPath} failed: ${res.status} ${res.statusText}`)
  }
  return res.json()
}

export function isBackendRunning(): boolean {
  return child !== null && backendPort !== null
}
