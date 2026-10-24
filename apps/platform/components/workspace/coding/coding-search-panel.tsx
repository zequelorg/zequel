'use client'

import { useState, useMemo } from 'react'
import { useWorkspaceStore } from '@/lib/store'
import { Input } from '@zequel/ui/components/input'
import { FileIcon } from './file-icon'
import { Search, ChevronDown, ChevronRight, CaseSensitive, WholeWord, Regex, ReplaceAll } from 'lucide-react'
import { cn } from '@/lib/utils'

export function CodingSearchPanel() {
  const { codingFiles, setActiveCodingFileId } = useWorkspaceStore()
  const [query, setQuery] = useState('')
  const [replaceQuery, setReplaceQuery] = useState('')
  const [showReplace, setShowReplace] = useState(false)
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [wholeWord, setWholeWord] = useState(false)
  const [useRegex, setUseRegex] = useState(false)

  const results = useMemo(() => {
    if (!query.trim()) return []
    const matchedFiles: {
      fileId: string
      fileName: string
      matches: { line: number; text: string; index: number }[]
    }[] = []

    let searchRegex: RegExp | null = null
    try {
      if (useRegex) {
        searchRegex = new RegExp(query, caseSensitive ? 'g' : 'gi')
      }
    } catch {
      return []
    }

    for (const file of codingFiles) {
      if (file.kind === 'upload') continue
      const lines = file.content.split('\n')
      const matches: { line: number; text: string; index: number }[] = []

      lines.forEach((lineText, idx) => {
        if (useRegex && searchRegex) {
          searchRegex.lastIndex = 0
          if (searchRegex.test(lineText)) {
            matches.push({ line: idx + 1, text: lineText.trim(), index: 0 })
          }
        } else {
          let lineToSearch = lineText
          let q = query
          if (!caseSensitive) {
            lineToSearch = lineToSearch.toLowerCase()
            q = q.toLowerCase()
          }

          if (wholeWord) {
            const regex = new RegExp(`\\b${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, caseSensitive ? '' : 'i')
            if (regex.test(lineText)) {
              matches.push({ line: idx + 1, text: lineText.trim(), index: lineToSearch.indexOf(q) })
            }
          } else {
            if (lineToSearch.includes(q)) {
              matches.push({ line: idx + 1, text: lineText.trim(), index: lineToSearch.indexOf(q) })
            }
          }
        }
      })

      if (matches.length > 0) {
        matchedFiles.push({ fileId: file.id, fileName: file.name, matches })
      }
    }

    return matchedFiles
  }, [query, caseSensitive, wholeWord, useRegex, codingFiles])

  const totalMatches = results.reduce((acc, r) => acc + r.matches.length, 0)

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-foreground">
          Search Workspace
        </span>
      </div>

      <div className="flex flex-col gap-2 p-3">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowReplace(!showReplace)}
            className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
            title="Toggle Replace"
          >
            {showReplace ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search (e.g. function, import)"
              className="h-8 pl-8 pr-20 font-mono text-xs"
            />
            <div className="absolute right-1.5 top-1 flex items-center gap-0.5">
              <button
                onClick={() => setCaseSensitive(!caseSensitive)}
                className={cn('rounded p-1 text-[10px]', caseSensitive ? 'bg-foreground text-background' : 'text-muted-foreground')}
                title="Match Case"
              >
                <CaseSensitive className="h-3 w-3" />
              </button>
              <button
                onClick={() => setWholeWord(!wholeWord)}
                className={cn('rounded p-1 text-[10px]', wholeWord ? 'bg-foreground text-background' : 'text-muted-foreground')}
                title="Match Whole Word"
              >
                <WholeWord className="h-3 w-3" />
              </button>
              <button
                onClick={() => setUseRegex(!useRegex)}
                className={cn('rounded p-1 text-[10px]', useRegex ? 'bg-foreground text-background' : 'text-muted-foreground')}
                title="Use Regular Expression"
              >
                <Regex className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>

        {showReplace && (
          <div className="ml-5 flex items-center gap-1.5">
            <Input
              value={replaceQuery}
              onChange={(e) => setReplaceQuery(e.target.value)}
              placeholder="Replace"
              className="h-8 font-mono text-xs"
            />
            <button
              className="rounded border border-border p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
              title="Replace All"
            >
              <ReplaceAll className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {query && (
          <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {totalMatches} result{totalMatches === 1 ? '' : 's'} in {results.length} file{results.length === 1 ? '' : 's'}
          </div>
        )}

        <div className="flex flex-col gap-2">
          {results.map((res) => (
            <div key={res.fileId} className="flex flex-col gap-1">
              <button
                onClick={() => setActiveCodingFileId(res.fileId)}
                className="flex items-center gap-1.5 rounded p-1 text-left font-mono text-xs text-foreground hover:bg-secondary"
              >
                <FileIcon fileName={res.fileName} size={14} />
                <span className="font-semibold">{res.fileName}</span>
                <span className="ml-auto rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {res.matches.length}
                </span>
              </button>
              <div className="ml-5 flex flex-col gap-0.5">
                {res.matches.map((m, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveCodingFileId(res.fileId)}
                    className="flex items-center gap-2 rounded px-1.5 py-1 text-left font-mono text-[11px] text-muted-foreground hover:bg-secondary hover:text-foreground"
                  >
                    <span className="w-6 shrink-0 text-right text-muted-foreground/60">{m.line}:</span>
                    <span className="truncate">{m.text}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
          {query && results.length === 0 && (
            <p className="px-1 py-4 font-sans text-xs text-muted-foreground">
              No results found for &ldquo;{query}&rdquo;.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
