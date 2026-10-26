import { Files, Share2, ShieldAlert } from 'lucide-react'

export type ActivityView = 'explorer' | 'findings' | 'research'

interface ActivityBarProps {
  active: ActivityView
  onChange: (view: ActivityView) => void
}

/**
 * The slim icon rail along the left edge — VS Code's Activity Bar is the
 * design benchmark (a fixed-width column of view-switching icons, active
 * one marked with a left accent bar), not copied pixel-for-pixel. Only
 * views that are actually real and wired get an icon here: Explorer (the
 * file tree), Findings (the indexer's heuristic leads), and Research (the
 * trace graph). No placeholder icons for
 * features that don't exist yet — an inert button that looks clickable is
 * worse than no button.
 */
export function ActivityBar({ active, onChange }: ActivityBarProps) {
  return (
    <div className="activity-bar">
      <button
        className={`activity-bar-btn${active === 'explorer' ? ' active' : ''}`}
        onClick={() => onChange('explorer')}
        title="Explorer"
      >
        <Files className="h-5 w-5" />
      </button>
      <button
        className={`activity-bar-btn${active === 'findings' ? ' active' : ''}`}
        onClick={() => onChange('findings')}
        title="Findings — heuristic security leads"
      >
        <ShieldAlert className="h-5 w-5" />
      </button>
      <button
        className={`activity-bar-btn${active === 'research' ? ' active' : ''}`}
        onClick={() => onChange('research')}
        title="Research — reference trace graph"
      >
        <Share2 className="h-5 w-5" />
      </button>
    </div>
  )
}
