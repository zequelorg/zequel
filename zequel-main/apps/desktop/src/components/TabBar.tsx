import { X } from 'lucide-react'
import { fileIconFor } from '@/lib/file-icon'

export interface OpenTab {
  path: string
  isDirty: boolean
}

interface TabBarProps {
  tabs: OpenTab[]
  activePath: string | null
  onSelect: (path: string) => void
  onClose: (path: string) => void
}

function baseName(path: string): string {
  return path.split('/').pop() ?? path
}

/**
 * Multiple files open at once, VS Code-style tab strip: active tab
 * highlighted, unsaved files show a dot instead of an X until hovered (CSS
 * handles the hover swap), click anywhere on a tab to switch to it, click
 * the X to close it without switching first.
 */
export function TabBar({ tabs, activePath, onSelect, onClose }: TabBarProps) {
  if (tabs.length === 0) return null
  return (
    <div className="tab-bar">
      {tabs.map((tab) => {
        const { icon: FileGlyph, color } = fileIconFor(tab.path)
        const active = tab.path === activePath
        return (
          <div
            key={tab.path}
            className={`tab${active ? ' tab--active' : ''}`}
            onClick={() => onSelect(tab.path)}
            title={tab.path}
          >
            <FileGlyph className="h-3.5 w-3.5 tab-file-icon" style={{ color }} />
            <span className="tab-label">{baseName(tab.path)}</span>
            <button
              className={`tab-close${tab.isDirty ? ' tab-close--dirty' : ''}`}
              onClick={(e) => {
                e.stopPropagation()
                onClose(tab.path)
              }}
              title={tab.isDirty ? 'Unsaved changes — click to close anyway' : 'Close'}
            >
              <span className="tab-close-dot" />
              <X className="h-3 w-3 tab-close-x" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
