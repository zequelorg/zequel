'use client'

import { useMemo, useRef, useState } from 'react'
import { createClient } from '@zequel/shared/supabase/client'
import { useWorkspaceStore } from '@/lib/store'
import { useLoadCodingProject } from './use-coding-bootstrap'
import { getLanguageMeta, languageFromFileName } from '@/lib/coding/languages'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { Button } from '@zequel/ui/components/button'
import { Input } from '@zequel/ui/components/input'
import { Separator } from '@zequel/ui/components/separator'
import { ThemeToggle } from '@zequel/ui/components/theme-toggle'
import { Avatar, AvatarImage, AvatarFallback } from '@zequel/ui/components/avatar'
import { useToast } from '@zequel/ui/hooks/use-toast'
import { FileIcon, FolderIcon } from './file-icon'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@zequel/ui/components/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@zequel/ui/components/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@zequel/ui/components/alert-dialog'
import {
  FilePlus,
  FolderPlus,
  Folder,
  MoreVertical,
  Pencil,
  Trash2,
  Check,
  X,
  ChevronRight,
  ChevronDown,
  Plus,
  Box,
  Settings,
  Upload,
  FolderInput,
  CornerUpLeft,
} from 'lucide-react'
import type {
  CodingFile,
  CodingFolder,
  CodingProject,
  Profile,
} from '@zequel/types'

type CreateTarget = { kind: 'file' | 'folder'; parentId: string | null } | null
type DeleteTarget = { type: 'file' | 'folder' | 'project'; id: string; name: string } | null

const UPLOAD_BUCKET = 'coding-files'
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024 // 10MB

// Extensions that are always treated as binary assets (stored, never editable),
// even though some could technically be read as text.
const BINARY_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'bmp', 'ico', 'svg', 'tiff',
  'pdf', 'zip', 'rar', '7z', 'gz', 'tar', 'mp3', 'wav', 'ogg', 'flac',
  'mp4', 'mov', 'webm', 'avi', 'mkv', 'woff', 'woff2', 'ttf', 'otf', 'eot',
  'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'exe', 'dll', 'bin', 'dmg',
])

// Decide whether an uploaded file should become an editable text/code file
// (treated exactly like a created file) or be stored as a binary asset.
function isTextLikeUpload(file: File): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (BINARY_EXTENSIONS.has(ext)) return false
  const mime = file.type
  if (mime) {
    if (mime.startsWith('text/')) return true
    if (mime.startsWith('image/') || mime.startsWith('audio/') || mime.startsWith('video/'))
      return false
    if (mime === 'application/pdf') return false
    // Common text-based application types
    if (/(json|xml|javascript|typescript|x-sh|x-yaml|yaml|sql|csv|toml)/.test(mime)) return true
  }
  // Fall back to extension: anything we recognize as a language is editable.
  if (languageFromFileName(file.name) !== 'plaintext') return true
  // Unknown + no extension → default to editable plain text (e.g. "Dockerfile").
  return ext === '' || ext === 'txt' || ext === 'log' || ext === 'env'
}

function getDisplayName(profile?: Profile | null, userEmail?: string) {
  if (profile?.full_name) return profile.full_name
  if (profile?.display_name) return profile.display_name
  if (profile?.username) return `@${profile.username}`
  return userEmail || 'Account'
}

function getInitials(profile?: Profile | null, userEmail?: string) {
  const name = profile?.full_name || profile?.display_name || userEmail || 'U'
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function CodingFilesPanel({
  hideHeader,
  userEmail,
  profile,
}: {
  hideHeader?: boolean
  userEmail?: string
  profile?: Profile | null
}) {
  const {
    codingProjects,
    codingProject,
    addCodingProject,
    removeCodingProject,
    setCodingProject,
    setCodingProjects,
    codingFolders,
    addCodingFolder,
    updateCodingFolder,
    removeCodingFolder,
    expandedFolderIds,
    toggleFolderExpanded,
    setFolderExpanded,
    codingFiles,
    addCodingFile,
    updateCodingFile,
    removeCodingFile,
    activeCodingFileId,
    setActiveCodingFileId,
    openCodingFileIds = [],
    closeCodingFile,
  } = useWorkspaceStore()

  const { toast } = useToast()
  const loadProject = useLoadCodingProject()
  const uploadInputRef = useRef<HTMLInputElement>(null)

  const [createTarget, setCreateTarget] = useState<CreateTarget>(null)
  const [newName, setNewName] = useState('')
  const [renaming, setRenaming] = useState<{ type: 'file' | 'folder'; id: string } | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [creatingProject, setCreatingProject] = useState(false)
  const [projectName, setProjectName] = useState('')
  const [busy, setBusy] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null)
  // Folder targeted by the upload picker (null = project root).
  const [uploadParent, setUploadParent] = useState<string | null>(null)
  // Item whose "Move to…" dialog is open.
  const [moveTarget, setMoveTarget] = useState<
    | { type: 'file'; id: string; name: string; currentParentId: string | null }
    | { type: 'folder'; id: string; name: string; currentParentId: string | null }
    | null
  >(null)
  // Drag-and-drop: the item currently being dragged and the folder hovered.
  const [draggingItem, setDraggingItem] = useState<
    { type: 'file' | 'folder'; id: string } | null
  >(null)
  const [dropTargetId, setDropTargetId] = useState<string | null | 'root'>(null)

  const getUser = async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    return user
  }

  // ─── Projects ──────────────────────────────────────────────────────────
  const handleCreateProject = async () => {
    if (busy) return
    const name = projectName.trim() || 'Untitled Project'
    setBusy(true)
    const user = await getUser()
    if (!user) return setBusy(false)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('coding_projects')
      .insert({ user_id: user.id, name })
      .select()
      .single()
    if (data && !error) {
      addCodingProject(data as CodingProject)
      await loadProject(data as CodingProject)
      toast({ title: 'Project created', description: name })
    } else {
      toast({ title: 'Could not create project', variant: 'destructive' })
    }
    setProjectName('')
    setCreatingProject(false)
    setBusy(false)
  }

  const handleSwitchProject = async (project: CodingProject) => {
    if (project.id === codingProject?.id) return
    await loadProject(project)
  }

  const handleDeleteProject = async (project: CodingProject) => {
    const supabase = createClient()
    removeCodingProject(project.id)
    await supabase.from('coding_projects').delete().eq('id', project.id)
    if (project.id === codingProject?.id) {
      const remaining = codingProjects.filter((p) => p.id !== project.id)
      if (remaining[0]) await loadProject(remaining[0])
      else {
        setCodingProject(null)
        setCodingProjects([])
      }
    }
    toast({ title: 'Project deleted', description: project.name })
  }

  // ─── Folders ───────────────────────────────────────────────────────────
  const handleCreateFolder = async (parentId: string | null) => {
    if (!codingProject || busy) return
    const name = newName.trim() || 'new-folder'
    setBusy(true)
    const user = await getUser()
    if (!user) return setBusy(false)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('coding_folders')
      .insert({
        project_id: codingProject.id,
        user_id: user.id,
        parent_id: parentId,
        name,
      })
      .select()
      .single()
    if (data && !error) addCodingFolder(data as CodingFolder)
    resetCreate()
    setBusy(false)
  }

  // ─── Files ─────────────────────────────────────────────────────────────
  const handleCreateFile = async (parentId: string | null) => {
    if (!codingProject || busy) return
    const trimmed = newName.trim()
    // The user just types a filename with an extension (e.g. "index.html").
    // If they omit an extension, default to a plain .txt file.
    const name = trimmed ? (trimmed.includes('.') ? trimmed : `${trimmed}.txt`) : 'untitled.txt'
    const language = languageFromFileName(name)

    setBusy(true)
    const user = await getUser()
    if (!user) return setBusy(false)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('coding_files')
      .insert({
        project_id: codingProject.id,
        user_id: user.id,
        folder_id: parentId,
        name,
        language,
        content: getLanguageMeta(language).starter,
        kind: 'text',
      })
      .select()
      .single()
    if (data && !error) {
      addCodingFile(data as CodingFile)
      setActiveCodingFileId((data as CodingFile).id)
    }
    resetCreate()
    setBusy(false)
  }

  // ─── Upload (images & other assets) ──────────────────────────────────────
  const openUploadPicker = (parentId: string | null) => {
    setUploadParent(parentId)
    // Defer so state is set before the dialog opens.
    requestAnimationFrame(() => uploadInputRef.current?.click())
  }

  const handleUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0 || !codingProject) return
    const user = await getUser()
    if (!user) return
    const supabase = createClient()
    setBusy(true)
    let uploaded = 0

    for (const file of Array.from(fileList)) {
      if (file.size > MAX_UPLOAD_BYTES) {
        toast({
          title: 'File too large',
          description: `${file.name} exceeds the 10MB limit.`,
          variant: 'destructive',
        })
        continue
      }

      // ── Text / code files become real editable files (like created ones) ──
      if (isTextLikeUpload(file)) {
        let content = ''
        try {
          content = await file.text()
        } catch {
          toast({
            title: 'Could not read file',
            description: file.name,
            variant: 'destructive',
          })
          continue
        }
        const language = languageFromFileName(file.name)
        const { data, error } = await supabase
          .from('coding_files')
          .insert({
            project_id: codingProject.id,
            user_id: user.id,
            folder_id: uploadParent,
            name: file.name,
            language,
            content,
            kind: 'text',
          })
          .select()
          .single()
        if (data && !error) {
          addCodingFile(data as CodingFile)
          uploaded += 1
        } else {
          toast({
            title: 'Upload failed',
            description: file.name,
            variant: 'destructive',
          })
        }
        continue
      }

      // ── Binary assets (images, PDFs, etc.) are stored and previewed ──
      const safeName = file.name.replace(/[^\w.\-]+/g, '_')
      const path = `${user.id}/${codingProject.id}/${crypto.randomUUID()}-${safeName}`
      const { error: upErr } = await supabase.storage
        .from(UPLOAD_BUCKET)
        .upload(path, file, { contentType: file.type || undefined, upsert: false })
      if (upErr) {
        toast({
          title: 'Upload failed',
          description: `${file.name}: ${upErr.message}`,
          variant: 'destructive',
        })
        continue
      }
      const { data, error } = await supabase
        .from('coding_files')
        .insert({
          project_id: codingProject.id,
          user_id: user.id,
          folder_id: uploadParent,
          name: file.name,
          language: 'plaintext',
          content: '',
          kind: 'upload',
          storage_path: path,
          mime_type: file.type || null,
        })
        .select()
        .single()
      if (data && !error) {
        addCodingFile(data as CodingFile)
        uploaded += 1
      }
    }

    if (uploaded > 0) {
      if (uploadParent) setFolderExpanded(uploadParent, true)
      toast({
        title: 'Upload complete',
        description: `${uploaded} file${uploaded > 1 ? 's' : ''} added.`,
      })
    }
    if (uploadInputRef.current) uploadInputRef.current.value = ''
    setUploadParent(null)
    setBusy(false)
  }

  const resetCreate = () => {
    setNewName('')
    setCreateTarget(null)
  }

  const submitCreate = () => {
    if (!createTarget) return
    if (createTarget.kind === 'folder') void handleCreateFolder(createTarget.parentId)
    else void handleCreateFile(createTarget.parentId)
  }

  // ─── Rename ──────────────────────────────────────────────────────────────
  const handleRenameFile = async (file: CodingFile) => {
    const trimmed = renameValue.trim()
    if (!trimmed || trimmed === file.name) return setRenaming(null)
    // Only re-infer language for editable text files.
    const language = file.kind === 'upload' ? file.language : languageFromFileName(trimmed)
    updateCodingFile(file.id, { name: trimmed, language })
    setRenaming(null)
    const supabase = createClient()
    await supabase
      .from('coding_files')
      .update({ name: trimmed, language })
      .eq('id', file.id)
  }

  const handleRenameFolder = async (folder: CodingFolder) => {
    const trimmed = renameValue.trim()
    if (!trimmed || trimmed === folder.name) return setRenaming(null)
    updateCodingFolder(folder.id, { name: trimmed })
    setRenaming(null)
    const supabase = createClient()
    await supabase.from('coding_folders').update({ name: trimmed }).eq('id', folder.id)
  }

  // ─── Delete (confirmed) ──────────────────────────────────────────────────
  const confirmDelete = async () => {
    if (!deleteTarget) return
    const supabase = createClient()
    if (deleteTarget.type === 'file') {
      const file = codingFiles.find((f) => f.id === deleteTarget.id)
      removeCodingFile(deleteTarget.id)
      if (file?.storage_path) {
        await supabase.storage.from(UPLOAD_BUCKET).remove([file.storage_path])
      }
      await supabase.from('coding_files').delete().eq('id', deleteTarget.id)
    } else if (deleteTarget.type === 'folder') {
      // Remove uploaded assets in this folder subtree from storage first.
      const removedIds = collectFolderSubtree(deleteTarget.id)
      const paths = codingFiles
        .filter((f) => f.folder_id && removedIds.has(f.folder_id) && f.storage_path)
        .map((f) => f.storage_path as string)
      removeCodingFolder(deleteTarget.id)
      if (paths.length) await supabase.storage.from(UPLOAD_BUCKET).remove(paths)
      // DB cascade removes descendant folders + files automatically.
      await supabase.from('coding_folders').delete().eq('id', deleteTarget.id)
    } else if (deleteTarget.type === 'project') {
      const project = codingProjects.find((p) => p.id === deleteTarget.id)
      if (project) await handleDeleteProject(project)
    }
    setDeleteTarget(null)
  }

  // ─── Move ──────────────────────────────────────────────────────────────
  const handleMoveFile = async (file: CodingFile, folderId: string | null) => {
    if (file.folder_id === folderId) return
    updateCodingFile(file.id, { folder_id: folderId })
    if (folderId) setFolderExpanded(folderId, true)
    const supabase = createClient()
    await supabase.from('coding_files').update({ folder_id: folderId }).eq('id', file.id)
  }

  const handleMoveFolder = async (folder: CodingFolder, parentId: string | null) => {
    if (folder.parent_id === parentId) return
    // Prevent moving a folder into itself or a descendant.
    if (parentId && collectFolderSubtree(folder.id).has(parentId)) {
      toast({ title: "Can't move a folder into itself", variant: 'destructive' })
      return
    }
    updateCodingFolder(folder.id, { parent_id: parentId })
    if (parentId) setFolderExpanded(parentId, true)
    const supabase = createClient()
    await supabase.from('coding_folders').update({ parent_id: parentId }).eq('id', folder.id)
  }

  // Unified move used by both the Move dialog and drag-and-drop.
  const performMove = (
    item: { type: 'file' | 'folder'; id: string },
    destFolderId: string | null
  ) => {
    if (item.type === 'file') {
      const file = codingFiles.find((f) => f.id === item.id)
      if (file) void handleMoveFile(file, destFolderId)
    } else {
      const folder = codingFolders.find((f) => f.id === item.id)
      if (folder) void handleMoveFolder(folder, destFolderId)
    }
  }

  // ─── Drag & drop ─────────────────────────────────────────────────────────
  const onDropInto = (destFolderId: string | null) => {
    if (!draggingItem) return
    // Folder can't be dropped onto itself or a descendant.
    if (
      draggingItem.type === 'folder' &&
      destFolderId &&
      collectFolderSubtree(draggingItem.id).has(destFolderId)
    ) {
      toast({ title: "Can't move a folder into itself", variant: 'destructive' })
    } else {
      performMove(draggingItem, destFolderId)
    }
    setDraggingItem(null)
    setDropTargetId(null)
  }

  // ─── Derived tree structures ─────────────────────────────────────────────
  const foldersByParent = useMemo(() => {
    const map = new Map<string | null, CodingFolder[]>()
    for (const f of codingFolders) {
      const key = f.parent_id
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(f)
    }
    return map
  }, [codingFolders])

  const filesByFolder = useMemo(() => {
    const map = new Map<string | null, CodingFile[]>()
    for (const f of codingFiles) {
      const key = f.folder_id
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(f)
    }
    return map
  }, [codingFiles])

  // All folder ids in a subtree (inclusive), used for move/delete guards.
  const collectFolderSubtree = (rootId: string): Set<string> => {
    const ids = new Set<string>([rootId])
    let changed = true
    while (changed) {
      changed = false
      for (const f of codingFolders) {
        if (f.parent_id && ids.has(f.parent_id) && !ids.has(f.id)) {
          ids.add(f.id)
          changed = true
        }
      }
    }
    return ids
  }

  // Flat folder list with indented path labels for the "Move to" menus.
  const folderOptions = useMemo(() => {
    const out: { id: string; label: string; depth: number }[] = []
    const walk = (parentId: string | null, depth: number) => {
      for (const f of foldersByParent.get(parentId) ?? []) {
        out.push({ id: f.id, label: f.name, depth })
        walk(f.id, depth + 1)
      }
    }
    walk(null, 0)
    return out
  }, [foldersByParent])

  const startRename = (type: 'file' | 'folder', id: string, current: string) => {
    setRenaming({ type, id })
    setRenameValue(current)
  }

  // Recursive renderer for a folder's children (subfolders then files).
  const renderTree = (parentId: string | null, depth: number): React.ReactNode => {
    const subfolders = foldersByParent.get(parentId) ?? []
    const files = filesByFolder.get(parentId) ?? []
    const indent = { paddingLeft: `${depth * 12 + 8}px` }

    return (
      <>
        {subfolders.map((folder) => {
          const expanded = expandedFolderIds.includes(folder.id)
          const isRenaming = renaming?.type === 'folder' && renaming.id === folder.id
          return (
            <li key={folder.id}>
              {isRenaming ? (
                <RenameRow
                  style={indent}
                  value={renameValue}
                  onChange={setRenameValue}
                  onConfirm={() => handleRenameFolder(folder)}
                  onCancel={() => setRenaming(null)}
                />
              ) : (
                <div
                  draggable={!isRenaming}
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = 'move'
                    setDraggingItem({ type: 'folder', id: folder.id })
                  }}
                  onDragEnd={() => {
                    setDraggingItem(null)
                    setDropTargetId(null)
                  }}
                  onDragOver={(e) => {
                    if (!draggingItem) return
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'move'
                    if (dropTargetId !== folder.id) setDropTargetId(folder.id)
                  }}
                  onDragLeave={(e) => {
                    // Only clear if leaving the row entirely (not entering a child).
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                      setDropTargetId((prev) => (prev === folder.id ? null : prev))
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    onDropInto(folder.id)
                  }}
                  className={cn(
                    'group flex items-center gap-1 rounded-md py-1.5 pr-1 text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground',
                    dropTargetId === folder.id &&
                      'bg-foreground/10 ring-1 ring-inset ring-foreground/30',
                    draggingItem?.id === folder.id && 'opacity-50'
                  )}
                  style={indent}
                >
                  <button
                    onClick={() => toggleFolderExpanded(folder.id)}
                    className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                  >
                    {expanded ? (
                      <ChevronDown className="h-3 w-3 shrink-0" />
                    ) : (
                      <ChevronRight className="h-3 w-3 shrink-0" />
                    )}
                    {expanded ? (
                      <FolderIcon open size={16} />
                    ) : (
                      <FolderIcon size={16} />
                    )}
                    <span className="truncate font-mono text-xs">{folder.name}</span>
                  </button>
                  <FolderMenu
                    folder={folder}
                    onNewFile={() => {
                      setCreateTarget({ kind: 'file', parentId: folder.id })
                      if (!expanded) toggleFolderExpanded(folder.id)
                    }}
                    onNewFolder={() => {
                      setCreateTarget({ kind: 'folder', parentId: folder.id })
                      if (!expanded) toggleFolderExpanded(folder.id)
                    }}
                    onUpload={() => openUploadPicker(folder.id)}
                    onRename={() => startRename('folder', folder.id, folder.name)}
                    onDelete={() =>
                      setDeleteTarget({ type: 'folder', id: folder.id, name: folder.name })
                    }
                    onMove={() =>
                      setMoveTarget({
                        type: 'folder',
                        id: folder.id,
                        name: folder.name,
                        currentParentId: folder.parent_id,
                      })
                    }
                  />
                </div>
              )}
              {expanded && (
                <>
                  {createTarget &&
                    createTarget.parentId === folder.id &&
                    renderCreateRow(depth + 1)}
                  <ul className="flex flex-col">{renderTree(folder.id, depth + 1)}</ul>
                </>
              )}
            </li>
          )
        })}

        {files.map((file) => {
          const isActive = file.id === activeCodingFileId
          const isRenaming = renaming?.type === 'file' && renaming.id === file.id
          return (
            <li key={file.id}>
              {isRenaming ? (
                <RenameRow
                  style={indent}
                  value={renameValue}
                  onChange={setRenameValue}
                  onConfirm={() => handleRenameFile(file)}
                  onCancel={() => setRenaming(null)}
                />
              ) : (
                <div
                  draggable={!isRenaming}
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = 'move'
                    setDraggingItem({ type: 'file', id: file.id })
                  }}
                  onDragEnd={() => {
                    setDraggingItem(null)
                    setDropTargetId(null)
                  }}
                  className={cn(
                    'group flex items-center gap-1 rounded-md py-1.5 pr-1 transition-colors',
                    isActive
                      ? 'bg-secondary text-foreground'
                      : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground',
                    draggingItem?.id === file.id && 'opacity-50'
                  )}
                  style={indent}
                >
                  <button
                    onClick={() => setActiveCodingFileId(file.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <FileIcon fileName={file.name} size={16} />
                    <span className="truncate font-mono text-xs">{file.name}</span>
                  </button>
                  <FileMenu
                    file={file}
                    onRename={() => startRename('file', file.id, file.name)}
                    onDelete={() =>
                      setDeleteTarget({ type: 'file', id: file.id, name: file.name })
                    }
                    onMove={() =>
                      setMoveTarget({
                        type: 'file',
                        id: file.id,
                        name: file.name,
                        currentParentId: file.folder_id,
                      })
                    }
                  />
                </div>
              )}
            </li>
          )
        })}
      </>
    )
  }

  // Inline create form (file or folder) at a given depth.
  const renderCreateRow = (depth: number) => (
    <li>
      <div
        className="mx-1 my-1 flex flex-col gap-2 rounded-md border border-border bg-secondary/30 p-2"
        style={{ marginLeft: `${depth * 12 + 4}px` }}
      >
        <Input
          autoFocus
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submitCreate()
            if (e.key === 'Escape') resetCreate()
          }}
          placeholder={createTarget?.kind === 'folder' ? 'folder name' : 'filename.ext'}
          className="h-8 font-mono text-xs"
        />
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={submitCreate}
            disabled={busy}
            className="h-8 flex-1 bg-foreground font-mono text-[10px] uppercase tracking-wider text-background hover:bg-foreground/90"
          >
            Add
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={resetCreate}
            className="h-8 px-2 font-mono text-[10px] uppercase tracking-wider"
          >
            Cancel
          </Button>
        </div>
      </div>
    </li>
  )

  const isEmpty = codingFolders.length === 0 && codingFiles.length === 0

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Hidden input powering uploads from the toolbar and folder menus. */}
      <input
        ref={uploadInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handleUpload(e.target.files)}
      />

      {!hideHeader && (
        <div className="flex shrink-0 items-center justify-between px-4 py-3">
          <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-foreground">
            Explorer
          </span>
        </div>
      )}

      {/* Project (repo) switcher */}
      <div className="shrink-0 px-3 pb-2">
        <div className="flex items-center gap-1.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-border bg-secondary/40 px-2.5 py-2 text-left transition-colors hover:bg-secondary">
                <Box className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate font-mono text-xs text-foreground">
                  {codingProject?.name ?? 'Select project'}
                </span>
                <ChevronDown className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-60">
              <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-wider">
                Projects
              </DropdownMenuLabel>
              {codingProjects.map((p) => (
                <DropdownMenuItem
                  key={p.id}
                  onClick={() => handleSwitchProject(p)}
                  className="group/item gap-2 font-mono text-xs"
                >
                  <Box className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{p.name}</span>
                  {p.id === codingProject?.id && (
                    <Check className="ml-auto h-3.5 w-3.5" />
                  )}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setCreatingProject(true)}
                className="gap-2 font-sans text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                New project
              </DropdownMenuItem>
              {codingProject && codingProjects.length > 1 && (
                <DropdownMenuItem
                  onClick={() =>
                    setDeleteTarget({
                      type: 'project',
                      id: codingProject.id,
                      name: codingProject.name,
                    })
                  }
                  className="gap-2 font-sans text-xs text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete current
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Root-level new file / new folder / upload */}
          <button
            onClick={() => setCreateTarget({ kind: 'file', parentId: null })}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label="New file"
            title="New file"
          >
            <FilePlus className="h-4 w-4" />
          </button>
          <button
            onClick={() => setCreateTarget({ kind: 'folder', parentId: null })}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label="New folder"
            title="New folder"
          >
            <FolderPlus className="h-4 w-4" />
          </button>
          <button
            onClick={() => openUploadPicker(null)}
            disabled={!codingProject || busy}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50"
            aria-label="Upload files"
            title="Upload files"
          >
            <Upload className="h-4 w-4" />
          </button>
        </div>

        {/* New project inline form */}
        {creatingProject && (
          <div className="mt-2 flex items-center gap-2 rounded-md border border-border bg-secondary/30 p-2">
            <Input
              autoFocus
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateProject()
                if (e.key === 'Escape') setCreatingProject(false)
              }}
              placeholder="project name"
              className="h-8 font-mono text-xs"
            />
            <Button
              size="sm"
              onClick={handleCreateProject}
              disabled={busy}
              className="h-8 bg-foreground font-mono text-[10px] uppercase tracking-wider text-background hover:bg-foreground/90"
            >
              Create
            </Button>
          </div>
        )}
      </div>

      {/* Tree & Open Editors */}
      <div
        className={cn(
          'min-h-0 flex-1 overflow-y-auto px-2 pb-3',
          draggingItem && dropTargetId === 'root' && 'bg-foreground/5'
        )}
      >
        {/* Open Editors Section */}
        {openCodingFileIds.length > 0 && (
          <div className="mb-3">
            <div className="flex items-center justify-between px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              <span>Open Editors</span>
            </div>
            <ul className="flex flex-col gap-0.5">
              {openCodingFileIds.map((id) => {
                const file = codingFiles.find((f) => f.id === id)
                if (!file) return null
                const isActive = file.id === activeCodingFileId
                return (
                  <li key={`open-${id}`}>
                    <div
                      className={cn(
                        'group flex items-center gap-2 rounded-md px-2 py-1 transition-colors cursor-pointer',
                        isActive
                          ? 'bg-secondary text-foreground'
                          : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                      )}
                      onClick={() => setActiveCodingFileId(file.id)}
                    >
                      <FileIcon fileName={file.name} size={14} />
                      <span className="truncate font-mono text-xs">{file.name}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          closeCodingFile(file.id)
                        }}
                        className="ml-auto opacity-0 group-hover:opacity-100 p-0.5 text-muted-foreground hover:text-foreground"
                        title="Close file"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {/* Folder Structure Header */}
        <div className="flex items-center justify-between px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground font-semibold border-t border-border/50 pt-2 mb-1">
          <span>Folder Structure</span>
        </div>
        {/* Root-level create row */}
        {createTarget && createTarget.parentId === null && renderCreateRow(0)}

        {isEmpty && !createTarget ? (
          <p className="px-2 py-4 font-sans text-xs leading-relaxed text-muted-foreground">
            No files yet. Use the file, folder, or upload buttons above to start
            building your project.
          </p>
        ) : (
          <ul className="flex flex-col">{renderTree(null, 0)}</ul>
        )}
      </div>

      {/* Profile footer — mirrors the documents panel so the avatar/settings
          stay reachable in Coding Mode on desktop. */}
      {!hideHeader && (
        <>
          <Separator />
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <Avatar className="h-6 w-6 shrink-0">
                {profile?.avatar_url ? (
                  <AvatarImage
                    src={profile.avatar_url}
                    alt={getDisplayName(profile, userEmail)}
                  />
                ) : null}
                <AvatarFallback className="bg-secondary font-mono text-[9px] text-foreground">
                  {getInitials(profile, userEmail)}
                </AvatarFallback>
              </Avatar>
              <span className="truncate font-mono text-[11px] text-muted-foreground">
                {getDisplayName(profile, userEmail)}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <ThemeToggle />
              <Link href="/settings">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                >
                  <Settings className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          </div>
        </>
      )}

      {/* Delete confirmation */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {deleteTarget?.type}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.type === 'folder'
                ? `"${deleteTarget?.name}" and everything inside it will be permanently deleted.`
                : deleteTarget?.type === 'project'
                  ? `The project "${deleteTarget?.name}" and all of its files and folders will be permanently deleted.`
                  : `"${deleteTarget?.name}" will be permanently deleted.`}{' '}
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Move to folder picker */}
      <Dialog
        open={moveTarget !== null}
        onOpenChange={(open) => !open && setMoveTarget(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm">
              Move &ldquo;{moveTarget?.name}&rdquo;
            </DialogTitle>
            <DialogDescription className="font-sans text-xs">
              Choose a destination folder.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-72 overflow-y-auto rounded-md border border-border">
            <button
              onClick={() => {
                if (moveTarget) performMove(moveTarget, null)
                setMoveTarget(null)
              }}
              disabled={moveTarget?.currentParentId === null}
              className="flex w-full items-center gap-2 px-3 py-2 text-left font-mono text-xs text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40"
            >
              <CornerUpLeft className="h-3.5 w-3.5 shrink-0" />
              Project root
            </button>
            <Separator />
            {folderOptions
              .filter(
                (opt) =>
                  // Don't allow moving a folder into itself or its descendants.
                  !(
                    moveTarget?.type === 'folder' &&
                    collectFolderSubtree(moveTarget.id).has(opt.id)
                  )
              )
              .map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => {
                    if (moveTarget) performMove(moveTarget, opt.id)
                    setMoveTarget(null)
                  }}
                  disabled={opt.id === moveTarget?.currentParentId}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left font-mono text-xs text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40"
                  style={{ paddingLeft: `${opt.depth * 14 + 12}px` }}
                >
                  <Folder className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{opt.label}</span>
                  {opt.id === moveTarget?.currentParentId && (
                    <Check className="ml-auto h-3.5 w-3.5 shrink-0" />
                  )}
                </button>
              ))}
            {folderOptions.length === 0 && (
              <p className="px-3 py-4 text-center font-sans text-xs text-muted-foreground">
                No folders yet. Create a folder first.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Small presentational helpers ───────────────────────────────────────────

function RenameRow({
  style,
  value,
  onChange,
  onConfirm,
  onCancel,
}: {
  style?: React.CSSProperties
  value: string
  onChange: (v: string) => void
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="flex items-center gap-1 py-1 pr-1" style={style}>
      <Input
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onConfirm()
          if (e.key === 'Escape') onCancel()
        }}
        className="h-7 font-mono text-xs"
      />
      <button
        onClick={onConfirm}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
        aria-label="Confirm"
      >
        <Check className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={onCancel}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
        aria-label="Cancel"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

function FolderMenu({
  folder,
  onNewFile,
  onNewFolder,
  onUpload,
  onRename,
  onDelete,
  onMove,
}: {
  folder: CodingFolder
  onNewFile: () => void
  onNewFolder: () => void
  onUpload: () => void
  onRename: () => void
  onDelete: () => void
  onMove: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground data-[state=open]:bg-secondary data-[state=open]:text-foreground"
          aria-label="Folder actions"
        >
          <MoreVertical className="h-3.5 w-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={onNewFile} className="gap-2 font-sans text-xs">
          <FilePlus className="h-3.5 w-3.5" />
          New file
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onNewFolder} className="gap-2 font-sans text-xs">
          <FolderPlus className="h-3.5 w-3.5" />
          New folder
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onUpload} className="gap-2 font-sans text-xs">
          <Upload className="h-3.5 w-3.5" />
          Upload files
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onMove} className="gap-2 font-sans text-xs">
          <FolderInput className="h-3.5 w-3.5" />
          Move to…
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onRename} className="gap-2 font-sans text-xs">
          <Pencil className="h-3.5 w-3.5" />
          Rename
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={onDelete}
          className="gap-2 font-sans text-xs text-destructive focus:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function FileMenu({
  file,
  onRename,
  onDelete,
  onMove,
}: {
  file: CodingFile
  onRename: () => void
  onDelete: () => void
  onMove: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground data-[state=open]:bg-secondary data-[state=open]:text-foreground"
          aria-label="File actions"
        >
          <MoreVertical className="h-3.5 w-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={onMove} className="gap-2 font-sans text-xs">
          <FolderInput className="h-3.5 w-3.5" />
          Move to…
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onRename} className="gap-2 font-sans text-xs">
          <Pencil className="h-3.5 w-3.5" />
          Rename
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={onDelete}
          className="gap-2 font-sans text-xs text-destructive focus:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
