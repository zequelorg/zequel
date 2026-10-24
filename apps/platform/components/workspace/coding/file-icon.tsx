'use client'

import { useEffect, useState } from 'react'
import { Icon, addCollection } from '@iconify/react'
import { cn } from '@/lib/utils'
import {
  getFileIconName,
  DEFAULT_FILE_ICON,
  DEFAULT_FOLDER_ICON,
  DEFAULT_FOLDER_OPEN_ICON,
} from '@/lib/coding/file-icons'
import iconData from '@/lib/coding/file-icons-data.json'

// Register the curated vscode-icons subset once, on the client, so icons render
// fully offline (no network requests to the Iconify API).
let registered = false
function ensureRegistered() {
  if (registered) return
  // addCollection accepts an IconifyJSON object; our generated JSON matches it.
  addCollection(iconData as Parameters<typeof addCollection>[0])
  registered = true
}

const PREFIX = (iconData as { prefix: string }).prefix

function iconRef(name: string) {
  return `${PREFIX}:${name}`
}

/**
 * VS Code-style file icon. Automatically maps a file name / extension to the
 * correct vscode-icons glyph (languages, frameworks, config files, package
 * managers, databases, cloud services, tooling) and falls back to a generic
 * file icon when nothing matches.
 */
export function FileIcon({
  fileName,
  className,
  size = 16,
}: {
  fileName: string
  className?: string
  size?: number
}) {
  // Register synchronously on first client render; re-render once ready so the
  // icon swaps in without a layout shift.
  const [ready, setReady] = useState(registered)
  useEffect(() => {
    ensureRegistered()
    setReady(true)
  }, [])

  const name = getFileIconName(fileName)

  return (
    <Icon
      icon={iconRef(ready ? name : DEFAULT_FILE_ICON)}
      width={size}
      height={size}
      className={cn('shrink-0', className)}
      aria-hidden
    />
  )
}

/** Folder icon (open/closed) using the same vscode-icons set. */
export function FolderIcon({
  open = false,
  className,
  size = 16,
}: {
  open?: boolean
  className?: string
  size?: number
}) {
  const [ready, setReady] = useState(registered)
  useEffect(() => {
    ensureRegistered()
    setReady(true)
  }, [])

  const name = open ? DEFAULT_FOLDER_OPEN_ICON : DEFAULT_FOLDER_ICON

  return (
    <Icon
      icon={iconRef(ready ? name : DEFAULT_FOLDER_ICON)}
      width={size}
      height={size}
      className={cn('shrink-0', className)}
      aria-hidden
    />
  )
}
