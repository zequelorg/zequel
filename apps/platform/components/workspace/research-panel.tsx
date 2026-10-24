'use client'

import { useState } from 'react'
import { Separator } from '@zequel/ui/components/separator'
import { Button } from '@zequel/ui/components/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@zequel/ui/components/select'
import { useWorkspaceStore } from '@/lib/store'
import type {
  OutputFormat,
  OutputBlock,
  SourceReference,
  ConfidenceLevel,
  QueryHistoryItem,
} from '@zequel/types'
import { OUTPUT_FORMAT_LABELS } from '@zequel/types'
import { cn } from '@/lib/utils'
import { Loader2, ArrowRight, History, Clock, ChevronLeft, Trash2, MessageSquare, Network } from 'lucide-react'
import { createClient } from '@zequel/shared/supabase/client'
import { UpgradeDialog, type RequiredPlan } from './upgrade-dialog'
import { GraphView } from './research/graph-view'

export function ResearchPanel() {
  const {
    selectedDocumentIds,
    documents,
    currentResult,
    setCurrentResult,
    isQuerying,
    setIsQuerying,
    setActiveSource,
    queryHistory,
    addQueryToHistory,
    removeQueryFromHistory,
  } = useWorkspaceStore()

  const [panelView, setPanelView] = useState<'query' | 'graph'>('query')
  const [query, setQuery] = useState('')
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('summarize')
  const [showHistory, setShowHistory] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [upgrade, setUpgrade] = useState<{
    open: boolean
    plan?: RequiredPlan
    message?: string
  }>({ open: false })

  const selectedDocs = documents.filter((d) =>
    selectedDocumentIds.includes(d.id)
  )

  const handleSubmit = async () => {
    if (!query.trim() || selectedDocs.length === 0) return
    setError(null)
    setIsQuerying(true)

    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query.trim(),
          output_format: outputFormat,
          document_ids: selectedDocumentIds,
        }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Request failed' }))
        // Feature gated by plan — show the upgrade notice instead of an error.
        if (res.status === 403 && errData?.upgradeRequired) {
          setUpgrade({
            open: true,
            plan: (errData.requiredPlan as RequiredPlan) || 'premium_lite',
            message: errData.error,
          })
          return
        }
        throw new Error(errData.error || 'Request failed')
      }

      const data = await res.json()
      setCurrentResult(data)

      // Add to local history
      addQueryToHistory({
        id: data.id || crypto.randomUUID(),
        user_id: '',
        query_text: query.trim(),
        output_format: outputFormat,
        document_ids: selectedDocumentIds,
        result: data,
        created_at: new Date().toISOString(),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process query')
    } finally {
      setIsQuerying(false)
    }
  }

  const handleLoadHistory = (item: QueryHistoryItem) => {
    setCurrentResult(item.result)
    setShowHistory(false)
  }

  const handleDeleteHistory = async (id: string) => {
    const supabase = createClient()
    await supabase.from('queries').delete().eq('id', id)
    removeQueryFromHistory(id)
  }

  // Tab bar shared across Query, History, and Graph views.
  const viewTabs = (
    <div className="flex shrink-0 items-center gap-1 border-b border-border px-3 py-1.5">
      <button
        onClick={() => setPanelView('query')}
        className={cn(
          'flex items-center gap-1.5 rounded-md px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-wider transition-colors',
          panelView === 'query'
            ? 'bg-secondary text-foreground'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <MessageSquare className="h-3 w-3" />
        Query
      </button>
      <button
        onClick={() => setPanelView('graph')}
        className={cn(
          'flex items-center gap-1.5 rounded-md px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-wider transition-colors',
          panelView === 'graph'
            ? 'bg-secondary text-foreground'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <Network className="h-3 w-3" />
        Graph
      </button>
    </div>
  )

  // Graph view
  if (panelView === 'graph') {
    return (
      <div className="flex h-full flex-col overflow-hidden bg-background">
        {viewTabs}
        <div className="min-h-0 flex-1">
          <GraphView />
        </div>
      </div>
    )
  }

  // History view
  if (showHistory) {
    return (
      <div className="flex h-full flex-col overflow-hidden bg-background">
        {viewTabs}
        <div className="flex shrink-0 items-center gap-3 px-6 py-4">
          <button
            onClick={() => setShowHistory(false)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-foreground">
            Query History
          </span>
          <span className="font-mono text-[10px] text-muted-foreground">
            {queryHistory.length}
          </span>
        </div>
        <Separator className="shrink-0" />

        <div
          className="min-h-0 flex-1 overflow-y-auto"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <div className="px-4 py-2">
            {queryHistory.length === 0 ? (
              <div className="py-16 text-center">
                <Clock className="mx-auto h-5 w-5 text-muted-foreground/40" />
                <p className="mt-3 font-mono text-[11px] text-muted-foreground uppercase tracking-wider">
                  No history yet
                </p>
                <p className="mt-1 font-sans text-xs text-muted-foreground/60">
                  Queries will appear here after you run them.
                </p>
              </div>
            ) : (
              <div className="flex flex-col">
                {queryHistory.map((item) => (
                  <div key={item.id} className="group flex items-start gap-2 border-b border-border py-3 last:border-0">
                    <button
                      onClick={() => handleLoadHistory(item)}
                      className="flex min-w-0 flex-1 flex-col gap-1 text-left transition-colors"
                    >
                      <p className="truncate font-sans text-sm font-medium text-foreground">
                        {item.query_text}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="rounded-sm border border-border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                          {OUTPUT_FORMAT_LABELS[item.output_format] || item.output_format}
                        </span>
                        <span className="font-mono text-[9px] text-muted-foreground/60">
                          {new Date(item.created_at).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </button>
                    <button
                      onClick={() => handleDeleteHistory(item.id)}
                      className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground/40 transition-colors hover:text-destructive"
                      aria-label="Delete query"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Main research view
  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      {viewTabs}
      {/* Query Input Block */}
      <div className="shrink-0 px-6 py-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Select
              value={outputFormat}
              onValueChange={(v) => setOutputFormat(v as OutputFormat)}
            >
              <SelectTrigger className="h-8 w-56 rounded-md border-border font-mono text-[11px] uppercase tracking-wider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover text-popover-foreground">
                {Object.entries(OUTPUT_FORMAT_LABELS).map(([key, label]) => (
                  <SelectItem
                    key={key}
                    value={key}
                    className="font-mono text-[11px] uppercase tracking-wider"
                  >
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex flex-1 items-center justify-end">
              {queryHistory.length > 0 && (
                <button
                  onClick={() => setShowHistory(true)}
                  className="flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[10px] text-muted-foreground uppercase tracking-wider transition-colors hover:text-foreground"
                >
                  <History className="h-3 w-3" />
                  History
                  <span className="rounded-full bg-secondary px-1.5 text-[9px]">
                    {queryHistory.length}
                  </span>
                </button>
              )}
            </div>
          </div>

          {selectedDocs.length > 1 && (
            <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
              {selectedDocs.length} documents selected
            </span>
          )}

          <div className="flex gap-2">
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                selectedDocs.length === 0
                  ? 'Select a document to begin analysis'
                  : 'Enter your research query...'
              }
              disabled={selectedDocs.length === 0}
              className="min-h-[80px] flex-1 resize-none rounded-md border border-border bg-background px-3 py-2.5 font-sans text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  handleSubmit()
                }
              }}
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-muted-foreground">
              {selectedDocs.length === 0
                ? 'No documents selected'
                : selectedDocs.map((d) => d.title).join(', ')}
            </span>
            <Button
              onClick={handleSubmit}
              disabled={!query.trim() || selectedDocs.length === 0 || isQuerying}
              className="h-8 gap-2 rounded-md bg-foreground px-4 font-mono text-[11px] font-medium uppercase tracking-wider text-background hover:bg-foreground/90 disabled:opacity-40"
            >
              {isQuerying ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Processing
                </>
              ) : (
                <>
                  Submit
                  <ArrowRight className="h-3 w-3" />
                </>
              )}
            </Button>
          </div>

          {error && (
            <p className="font-mono text-[11px] text-destructive">{error}</p>
          )}
        </div>
      </div>

      <Separator className="shrink-0" />

      {/* Output Area */}
      <div
        className="min-h-0 flex-1 overflow-y-auto"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div className="px-6 py-4">
          {!currentResult && !isQuerying && (
            <div className="py-16 text-center">
              <p className="font-mono text-[11px] text-muted-foreground uppercase tracking-wider">
                Structured Output
              </p>
              <p className="mt-2 font-sans text-sm text-muted-foreground/60">
                Select documents and submit a query to generate analysis.
              </p>
            </div>
          )}

          {isQuerying && (
            <div className="flex items-center justify-center py-16">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <p className="font-mono text-[11px] text-muted-foreground uppercase tracking-wider">
                  Analyzing documents
                </p>
              </div>
            </div>
          )}

          {currentResult && !isQuerying && (
            <div className="flex flex-col gap-0">
              {/* Query label */}
              <div className="mb-3 flex items-center gap-2">
                <span className="rounded-sm border border-border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                  {OUTPUT_FORMAT_LABELS[currentResult.output_format] || currentResult.output_format}
                </span>
                <span className="truncate font-mono text-[10px] text-muted-foreground/60">
                  {currentResult.query}
                </span>
              </div>

              {currentResult.blocks.map((block, i) => (
                <ResultBlock
                  key={block.id}
                  block={block}
                  onSourceClick={(source) => setActiveSource(source)}
                  isLast={i === currentResult.blocks.length - 1}
                />
              ))}

              {/* Confidence Summary */}
              <Separator className="my-4" />
              <ConfidenceSummary
                level={currentResult.confidence_level}
                strength={currentResult.evidence_strength}
                coverage={currentResult.document_coverage}
              />
            </div>
          )}
        </div>
      </div>

      <UpgradeDialog
        open={upgrade.open}
        onOpenChange={(open) => setUpgrade((prev) => ({ ...prev, open }))}
        featureName="Research Mode"
        requiredPlan={upgrade.plan}
        message={upgrade.message}
      />
    </div>
  )
}

function ResultBlock({
  block,
  onSourceClick,
  isLast,
}: {
  block: OutputBlock
  onSourceClick: (source: SourceReference) => void
  isLast: boolean
}) {
  return (
    <div>
      <div className="py-4">
        <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-foreground">
          {block.title}
        </h3>
        <Separator className="my-2" />
        <p className="font-sans text-sm leading-relaxed text-foreground">
          {block.content}
        </p>

        {block.sources.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {block.sources.map((source, i) => (
              <button
                key={i}
                onClick={() => onSourceClick(source)}
                className="rounded-sm border border-border px-2 py-0.5 font-mono text-[10px] text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
              >
                {'Page '}{source.page}{' \u2014 '}{source.section}
              </button>
            ))}
          </div>
        )}

        <div className="mt-2">
          <span
            className={cn(
              'font-mono text-[10px] font-semibold uppercase tracking-wider',
              block.confidence === 'high' && 'text-confidence-high',
              block.confidence === 'medium' && 'text-confidence-medium',
              block.confidence === 'low' && 'text-confidence-low'
            )}
          >
            {block.confidence}
          </span>
        </div>
      </div>
      {!isLast && <Separator />}
    </div>
  )
}

function ConfidenceSummary({
  level,
  strength,
  coverage,
}: {
  level: ConfidenceLevel
  strength: string
  coverage: number
}) {
  return (
    <div className="rounded-md border border-border bg-panel-bg px-4 py-3">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Confidence Level
          </span>
          <span
            className={cn(
              'font-mono text-xs font-bold uppercase tracking-wider',
              level === 'high' && 'text-confidence-high',
              level === 'medium' && 'text-confidence-medium',
              level === 'low' && 'text-confidence-low'
            )}
          >
            {level}
          </span>
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Evidence Strength
          </span>
          <span className="font-mono text-xs font-medium text-foreground capitalize">
            {strength}
          </span>
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Coverage
          </span>
          <span className="font-mono text-xs font-medium text-foreground">
            {coverage} {coverage === 1 ? 'document' : 'documents'}
          </span>
        </div>
      </div>
    </div>
  )
}
