'use client'

import { useEffect, useRef, useState } from 'react'
import { useCodingIdeStore } from '@/lib/coding/coding-ide-store'
import { cn } from '@/lib/utils'
import { TerminalSquare, Trash2, X, Sparkles, Loader2 } from 'lucide-react'

const HELP_TEXT = `Zequel terminal — client commands:
  help     show this message
  clear    clear the terminal
  status   show the current runtime connection

Any other command is dispatched to the coding runtime. Once an isolated
sandbox execution provider is connected, commands run inside it and stream real output.`

/**
 * Terminal UI wired to the CodingRuntime execution adapter.
 *
 * It never fabricates output: submitted commands are dispatched through
 * `runtime.execute()`, and the honest not-connected result is rendered until a
 * real PTY/sandbox backend is attached. `help`/`clear`/`status` are local UI
 * meta-commands, not sandbox execution.
 *
 * Styled with the same --code-bg/--code-fg tokens as the editor (code-editor.tsx)
 * so the terminal and editor are visually consistent and both track the app's
 * active light/dark theme, instead of being hardcoded to one palette.
 */
export function CodingTerminal({ onClose }: { onClose?: () => void }) {
  const {
    runtime,
    runtimeStatus,
    terminalLines,
    appendTerminalLine,
    clearTerminal,
    setAssistantPrefill,
    setAssistantOpen,
  } = useCodingIdeStore()

  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const historyRef = useRef<string[]>([])
  const historyIndexRef = useRef(-1)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [terminalLines, busy])

  const runCommand = async (raw: string) => {
    const cmd = raw.trim()
    appendTerminalLine({ stream: 'input', text: cmd })
    if (!cmd) return

    historyRef.current.unshift(cmd)
    historyIndexRef.current = -1

    if (cmd === 'clear') {
      clearTerminal()
      return
    }
    if (cmd === 'help') {
      appendTerminalLine({ stream: 'system', text: HELP_TEXT })
      return
    }
    if (cmd === 'status') {
      appendTerminalLine({
        stream: 'system',
        text: `Runtime: ${runtime.kind} — status: ${runtimeStatus}`,
      })
      return
    }

    setBusy(true)
    try {
      const result = await runtime.execute(cmd)
      if (result.stdout) appendTerminalLine({ stream: 'stdout', text: result.stdout })
      if (result.stderr) appendTerminalLine({ stream: 'stderr', text: result.stderr })
      if (!result.stdout && !result.stderr && result.error) {
        appendTerminalLine({ stream: 'stderr', text: result.error })
      }
    } finally {
      setBusy(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault()
      if (busy) return
      const value = input
      setInput('')
      void runCommand(value)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const h = historyRef.current
      if (h.length === 0) return
      historyIndexRef.current = Math.min(historyIndexRef.current + 1, h.length - 1)
      setInput(h[historyIndexRef.current] ?? '')
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      const h = historyRef.current
      if (historyIndexRef.current <= 0) {
        historyIndexRef.current = -1
        setInput('')
      } else {
        historyIndexRef.current -= 1
        setInput(h[historyIndexRef.current] ?? '')
      }
    }
  }

  const explainOutput = () => {
    const text = terminalLines
      .slice(-40)
      .map((l) => (l.stream === 'input' ? `$ ${l.text}` : l.text))
      .join('\n')
      .trim()
    if (!text) return
    setAssistantPrefill(
      `Explain this terminal output and tell me what it means:\n\n\`\`\`\n${text}\n\`\`\``
    )
    setAssistantOpen(true)
  }

  return (
    <div className="flex h-full flex-col bg-[var(--code-bg)]">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--code-fg)]/10 px-3 py-1.5">
        <div className="flex items-center gap-2">
          <TerminalSquare className="h-3.5 w-3.5 text-[var(--code-fg)]/70" />
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--code-fg)]/70">
            Terminal
          </span>
          <span
            className={cn(
              'ml-1 inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider',
              runtimeStatus === 'ready'
                ? 'border-[var(--code-fg)]/20 text-[var(--code-fg)]/70'
                : 'border-[var(--code-fg)]/10 text-[var(--code-fg)]/40'
            )}
          >
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                runtimeStatus === 'ready' ? 'bg-[var(--code-fg)]/80' : 'bg-[var(--code-fg)]/30'
              )}
            />
            {runtimeStatus === 'ready' ? 'Sandbox' : 'No sandbox'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={explainOutput}
            title="Explain output with Zequel AI"
            className="flex items-center gap-1 rounded px-1.5 py-1 font-mono text-[9px] uppercase tracking-wider text-[var(--code-fg)]/50 transition-colors hover:bg-[var(--code-fg)]/10 hover:text-[var(--code-fg)]/90"
          >
            <Sparkles className="h-3 w-3" />
            <span className="hidden sm:inline">Explain</span>
          </button>
          <button
            onClick={clearTerminal}
            title="Clear terminal"
            aria-label="Clear terminal"
            className="rounded p-1 text-[var(--code-fg)]/50 transition-colors hover:bg-[var(--code-fg)]/10 hover:text-[var(--code-fg)]/90"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              title="Close terminal"
              aria-label="Close terminal"
              className="rounded p-1 text-[var(--code-fg)]/50 transition-colors hover:bg-[var(--code-fg)]/10 hover:text-[var(--code-fg)]/90"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Output + input */}
      <div
        ref={scrollRef}
        onClick={() => inputRef.current?.focus()}
        className="min-h-0 flex-1 cursor-text overflow-y-auto px-3 py-2 font-mono text-[12px] leading-relaxed"
      >
        {terminalLines.length === 0 && (
          <p className="text-[var(--code-fg)]/40">
            Type <span className="text-[var(--code-fg)]/70">help</span> to get started. The
            runtime is not connected to a sandbox yet — commands report their
            real status instead of fake output.
          </p>
        )}
        {terminalLines.map((line) => (
          <pre
            key={line.id}
            className={cn(
              'whitespace-pre-wrap break-words',
              line.stream === 'input' && 'text-[var(--code-fg)]/90',
              line.stream === 'stdout' && 'text-[var(--code-fg)]/70',
              line.stream === 'stderr' && 'text-destructive',
              line.stream === 'system' && 'text-[var(--code-string)]'
            )}
          >
            {line.stream === 'input' ? `$ ${line.text}` : line.text}
          </pre>
        ))}

        {/* Active input line */}
        <div className="flex items-center gap-2">
          <span className="text-[var(--code-fg)]/50">$</span>
          {busy ? (
            <span className="flex items-center gap-2 text-[var(--code-fg)]/50">
              <Loader2 className="h-3 w-3 animate-spin" />
              running…
            </span>
          ) : (
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              spellCheck={false}
              autoComplete="off"
              aria-label="Terminal input"
              className="flex-1 bg-transparent font-mono text-[12px] text-[var(--code-fg)]/90 caret-[var(--code-fg)] placeholder:text-[var(--code-fg)]/30 focus:outline-none"
              placeholder=""
            />
          )}
        </div>
      </div>
    </div>
  )
}
