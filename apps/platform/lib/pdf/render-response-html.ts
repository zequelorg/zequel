import 'server-only'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkRehype from 'remark-rehype'
import rehypeKatex from 'rehype-katex'
import rehypeHighlight from 'rehype-highlight'
import rehypeStringify from 'rehype-stringify'
import { normalizeMath } from '@/lib/markdown/normalize-math'
import { PRINT_STYLES } from './print-styles'

const markdownToHtml = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkMath)
  .use(remarkRehype)
  .use(rehypeKatex)
  .use(rehypeHighlight, { detect: true, ignoreMissing: true })
  .use(rehypeStringify)

export const KATEX_CSS_URL = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css'
export const FONT_CSS_URL =
  'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600&display=swap'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Renders the same Markdown dialect and math/highlighting plugins used by the
 * chat renderer, without importing React server rendering into a Next route.
 * Raw HTML is intentionally not enabled, so model output cannot inject markup.
 */
export async function renderResponseHtml({ markdown, title }: { markdown: string; title: string }): Promise<string> {
  const body = String(await markdownToHtml.process(normalizeMath(markdown)))
  const exportedAt = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const safeTitle = escapeHtml(title)

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${safeTitle}</title>
<link rel="stylesheet" href="${FONT_CSS_URL}">
<link rel="stylesheet" href="${KATEX_CSS_URL}">
<style>${PRINT_STYLES}</style>
</head>
<body>
<header class="doc-header">
  <span class="doc-brand">Zequel</span>
  <span class="doc-meta">${safeTitle} &middot; ${escapeHtml(exportedAt)}</span>
</header>
${body}
</body>
</html>`
}
