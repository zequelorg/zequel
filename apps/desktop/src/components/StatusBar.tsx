import { BackendStatus } from '../BackendStatus'
import type { CursorPosition } from './CodeEditor'

interface StatusBarProps {
  activePath: string | null
  language: string | null
  cursor: CursorPosition | null
}

/**
 * The thin bar fixed to the very bottom of the window — VS Code's Status
 * Bar is the benchmark: dense, low-contrast, left-aligned file info and
 * right-aligned environment info. Only shows things that are real: there's
 * no fake git-branch segment (no git integration exists yet — see
 * docs/STATUS.md), no fake "Prettier"/formatter segment, nothing inert.
 */
export function StatusBar({ activePath, language, cursor }: StatusBarProps) {
  return (
    <footer className="status-bar">
      <div className="status-bar-left">
        {activePath && <span className="status-bar-item">{activePath}</span>}
      </div>
      <div className="status-bar-right">
        {cursor && (
          <span className="status-bar-item">
            Ln {cursor.line}, Col {cursor.col}
          </span>
        )}
        {language && <span className="status-bar-item status-bar-item--lang">{language}</span>}
        <BackendStatus />
      </div>
    </footer>
  )
}
