'use client'

import { cn } from '../lib/utils'

interface ZequelIconProps {
  className?: string
  size?: number
}

/**
 * Zequel Logo Icon — Pure SVG React Component
 * 
 * Accurate recreation of the geometric "Q" logo:
 * - Outer thick arc (C-shape, open at top-right ~45°)
 * - Inner smaller arc (creates the ring effect)
 * - Separate curved segment at top-right (disconnected)
 * - Diagonal tail extending to bottom-right
 * 
 * Uses currentColor — automatically adapts to light/dark mode:
 * - Light mode: inherits dark text color (black)
 * - Dark mode: inherits light text color (white)
 * 
 * No background — transparent, just the logo shape.
 */
export function ZequelIcon({ className, size = 24 }: ZequelIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('shrink-0', className)}
      aria-label="Zequel"
    >
      {/* Outer thick arc — main "C" shape, open at ~45° top-right */}
      <path
        d="M 45 8
           C 20 8, 4 26, 4 50
           C 4 74, 20 92, 45 92
           C 58 92, 69 86, 77 77
           L 65 65
           C 60 72, 53 76, 45 76
           C 28 76, 16 64, 16 50
           C 16 36, 28 24, 45 24
           C 53 24, 60 28, 65 35
           L 77 23
           C 69 14, 58 8, 45 8
           Z"
        fill="currentColor"
      />
      
      {/* Inner arc — smaller "C" creating the ring look */}
      <path
        d="M 45 38
           C 35 38, 28 45, 28 52
           C 28 59, 35 66, 45 66
           C 50 66, 55 63, 58 59
           L 45 46
           L 58 33
           C 55 35, 50 38, 45 38
           Z"
        fill="currentColor"
      />
      
      {/* Top-right disconnected arc segment */}
      <path
        d="M 72 10
           C 80 14, 86 20, 91 28
           L 79 40
           C 76 34, 71 29, 65 26
           Z"
        fill="currentColor"
      />
      
      {/* Diagonal tail — extends from center to bottom-right */}
      <path
        d="M 50 50
           L 96 96
           L 96 84
           L 62 50
           Z"
        fill="currentColor"
      />
    </svg>
  )
}

/**
 * Zequel Avatar — Icon wrapper for chat usage
 * No background, just the icon with proper sizing
 */
export function ZequelAvatar({ 
  className, 
  size = 24
}: { 
  className?: string
  size?: number
}) {
  return (
    <div 
      className={cn(
        'flex items-center justify-center shrink-0',
        className
      )}
      style={{ width: size, height: size }}
    >
      <ZequelIcon size={size} className="text-foreground" />
    </div>
  )
}
