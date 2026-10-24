'use client'

import { useState, useCallback, useMemo } from 'react'
import { normalizeMath } from '@/lib/markdown/normalize-math'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import rehypeHighlight from 'rehype-highlight'
import { Check, Copy } from 'lucide-react'
import type { Components } from 'react-markdown'

function CodeBlock({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  const [copied, setCopied] = useState(false)
  const lang = className?.replace('language-', '').replace('hljs ', '').split(' ')[0] || ''
  const displayLang = lang.replace('hljs', '').trim()

  const handleCopy = useCallback(() => {
    // Recursively extract text from React nodes
    const extractText = (node: React.ReactNode): string => {
      if (typeof node === 'string') return node
      if (typeof node === 'number') return String(node)
      if (node === null || node === undefined) return ''
      if (Array.isArray(node)) return node.map(extractText).join('')
      if (typeof node === 'object' && 'props' in node) {
        const element = node as React.ReactElement<{ children?: React.ReactNode }>
        return extractText(element.props.children)
      }
      return ''
    }

    const codeText = extractText(children)
    navigator.clipboard.writeText(codeText).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [children])

  return (
    <div className="group/code relative mb-4 overflow-hidden rounded-lg border border-border">
      {/* Header bar */}
      <div className="flex items-center justify-between bg-secondary/80 px-4 py-2">
        <span className="font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {displayLang || 'code'}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[10px] text-muted-foreground transition-colors hover:bg-background/50 hover:text-foreground"
          aria-label="Copy code"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              Copy
            </>
          )}
        </button>
      </div>
      {/* Code content */}
      <pre className="zequel-code overflow-x-auto p-4 font-mono text-[13px] leading-[1.6]">
        <code className={`${className || ''}`}>{children}</code>
      </pre>
    </div>
  )
}

const components: Components = {
  h1: ({ children }) => (
    <h1 className="mb-4 mt-6 font-sans text-xl font-bold tracking-tight text-foreground first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-3 mt-6 font-sans text-lg font-semibold tracking-tight text-foreground first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-2 mt-5 font-sans text-base font-semibold text-foreground first:mt-0">
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className="mb-2 mt-4 font-sans text-sm font-semibold text-foreground first:mt-0">
      {children}
    </h4>
  ),
  p: ({ children }) => (
    <p className="mb-3 break-words font-sans text-[14px] leading-[1.7] text-foreground last:mb-0">
      {children}
    </p>
  ),
  ul: ({ children }) => (
    <ul className="mb-3 ml-5 list-disc space-y-1.5 font-sans text-[14px] text-foreground marker:text-muted-foreground">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-3 ml-5 list-decimal space-y-1.5 font-sans text-[14px] text-foreground marker:text-muted-foreground">
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="leading-[1.7] pl-1">{children}</li>
  ),
  blockquote: ({ children }) => (
    <blockquote className="mb-4 border-l-3 border-foreground/20 bg-secondary/30 py-2 pl-4 pr-3 font-sans text-[14px] text-muted-foreground [&>p]:mb-0">
      {children}
    </blockquote>
  ),
  code: ({ className, children, ...props }) => {
    const isInline = !className
    if (isInline) {
      return (
        <code className="break-all rounded-md bg-secondary px-1.5 py-0.5 font-mono text-[13px] text-foreground">
          {children}
        </code>
      )
    }
    return (
      <code className={`${className || ''} text-[13px]`} {...props}>
        {children}
      </code>
    )
  },
  pre: ({ children }: { children?: React.ReactNode }) => {
    // Extract language and code from the children
    const child = children as React.ReactElement<{ className?: string; children?: React.ReactNode }>
    if (child?.props) {
      return (
        <CodeBlock className={child.props.className as string | undefined}>
          {child.props.children}
        </CodeBlock>
      )
    }
    return (
      <pre className="zequel-code mb-4 overflow-x-auto rounded-lg border border-border p-4 font-mono text-[13px] leading-[1.6]">
        {children}
      </pre>
    )
  },
  table: ({ children }) => (
    <div className="mb-4 overflow-x-auto rounded-lg border border-border">
      <table className="w-full border-collapse font-sans text-[14px]">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-secondary/60">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="border-b border-border px-4 py-2.5 text-left font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-b border-border/50 px-4 py-2.5 text-foreground last:border-b-0">
      {children}
    </td>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic text-foreground/90">{children}</em>
  ),
  hr: () => <hr className="my-6 border-border" />,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="break-all font-medium text-foreground underline decoration-foreground/30 underline-offset-4 transition-colors hover:decoration-foreground/60"
    >
      {children}
    </a>
  ),
}

interface MarkdownRendererProps {
  content: string
  className?: string
}

const remarkPlugins = [remarkGfm, remarkMath]
const rehypePlugins: NonNullable<React.ComponentProps<typeof ReactMarkdown>['rehypePlugins']> = [
  [rehypeKatex, { throwOnError: false, strict: 'ignore' }],
  [rehypeHighlight, { detect: true, ignoreMissing: true }],
]

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  const normalized = useMemo(() => normalizeMath(content), [content])
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins} components={components}>
        {normalized}
      </ReactMarkdown>
    </div>
  )
}
