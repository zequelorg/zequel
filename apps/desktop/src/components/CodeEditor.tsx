import { useCallback, useEffect, useMemo, useRef } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { EditorView, ViewUpdate } from '@codemirror/view'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'
import { javascript } from '@codemirror/lang-javascript'
import { python } from '@codemirror/lang-python'
import { html } from '@codemirror/lang-html'
import { css } from '@codemirror/lang-css'
import { java } from '@codemirror/lang-java'
import { cpp } from '@codemirror/lang-cpp'
import { sql } from '@codemirror/lang-sql'
import type { Extension } from '@codemirror/state'
import type { CodingLanguage } from '@/lib/coding-language'

function languageExtension(language: CodingLanguage): Extension[] {
  switch (language) {
    case 'javascript':
    case 'jsx':
      return [javascript({ jsx: true })]
    case 'typescript':
    case 'tsx':
      return [javascript({ jsx: true, typescript: true })]
    case 'json':
      return [javascript()]
    case 'python':
      return [python()]
    case 'html':
    case 'xml':
      return [html()]
    case 'css':
    case 'scss':
      return [css()]
    case 'java':
    case 'kotlin':
      return [java()]
    case 'cpp':
    case 'c':
    case 'csharp':
    case 'go':
    case 'rust':
    case 'swift':
    case 'dart':
      return [cpp()]
    case 'sql':
      return [sql()]
    case 'plaintext':
    case 'markdown':
      return []
    default:
      return [javascript()]
  }
}

// Editor chrome (background, gutters, selection, caret) is themed entirely
// through CSS custom properties, NOT hardcoded colors. `--code-bg` / `--code-fg`
// and friends are defined in index.css, and are the same tokens a future
// chat/markdown code-block renderer would use — ported unchanged from the
// web app's apps/platform/components/workspace/coding/code-editor.tsx, which
// is now deleted; this is the only surviving copy.
const zequelEditorTheme = EditorView.theme({
  '&': {
    backgroundColor: 'var(--code-bg)',
    color: 'var(--code-fg)',
    height: '100%',
    fontSize: '13px',
  },
  '.cm-content': {
    fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)',
    caretColor: 'var(--code-fg)',
    padding: '12px 0',
  },
  '.cm-gutters': {
    backgroundColor: 'var(--code-bg)',
    color: 'var(--code-comment)',
    border: 'none',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'color-mix(in srgb, var(--code-fg) 6%, transparent)',
    color: 'var(--code-fg)',
  },
  '.cm-activeLine': {
    backgroundColor: 'color-mix(in srgb, var(--code-fg) 4%, transparent)',
  },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
    backgroundColor: 'color-mix(in srgb, var(--code-fg) 15%, transparent) !important',
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: 'var(--code-fg)',
  },
  '.cm-lineNumbers .cm-gutterElement': {
    padding: '0 12px 0 8px',
  },
  '&.cm-focused': {
    outline: 'none',
  },
  '.cm-scroller': {
    fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)',
    lineHeight: '1.6',
  },
})

// Syntax token colors — mapped to the exact same --code-keyword / --code-string
// / --code-number / --code-function / --code-type / --code-comment tokens
// defined in index.css.
const zequelHighlightStyle = HighlightStyle.define([
  { tag: [t.comment, t.lineComment, t.blockComment], color: 'var(--code-comment)', fontStyle: 'italic' },
  { tag: [t.keyword, t.controlKeyword, t.moduleKeyword, t.operatorKeyword, t.bool, t.null], color: 'var(--code-keyword)' },
  { tag: [t.string, t.special(t.string), t.regexp], color: 'var(--code-string)' },
  { tag: [t.number, t.integer, t.float, t.attributeName], color: 'var(--code-number)' },
  { tag: [t.function(t.variableName), t.function(t.propertyName), t.className, t.labelName], color: 'var(--code-function)' },
  { tag: [t.typeName, t.namespace, t.tagName], color: 'var(--code-type)' },
  { tag: t.invalid, color: 'var(--destructive)' },
])

export interface CursorPosition {
  line: number
  col: number
}

export interface RevealRequest {
  line: number // 1-based
  nonce: number // changes on every request so the same line can be revealed twice
}

interface CodeEditorProps {
  value: string
  language: CodingLanguage
  onChange: (value: string) => void
  onCursorChange?: (pos: CursorPosition) => void
  readOnly?: boolean
  reveal?: RevealRequest | null
  // Called once the reveal has been applied, so the owner can clear it and a
  // later tab switch doesn't jump the cursor again.
  onRevealed?: () => void
}

export function CodeEditor({
  value,
  language,
  onChange,
  onCursorChange,
  readOnly,
  reveal,
  onRevealed,
}: CodeEditorProps) {
  const viewRef = useRef<EditorView | null>(null)
  const appliedNonce = useRef<number | null>(null)

  // Move the cursor to the requested line and center it. Safe to call before
  // the view exists (it just returns); onCreateEditor and the effect below
  // both call it, whichever happens last wins and the nonce makes it once-only.
  const applyReveal = useCallback(() => {
    const view = viewRef.current
    if (!view || !reveal || appliedNonce.current === reveal.nonce) return
    appliedNonce.current = reveal.nonce
    const line = Math.min(Math.max(reveal.line, 1), view.state.doc.lines)
    const pos = view.state.doc.line(line).from
    view.dispatch({
      selection: { anchor: pos },
      effects: EditorView.scrollIntoView(pos, { y: 'center' }),
    })
    view.focus()
    onRevealed?.()
  }, [reveal, onRevealed])

  useEffect(() => {
    applyReveal()
  }, [applyReveal])

  const extensions = useMemo(
    () => [
      ...languageExtension(language),
      zequelEditorTheme,
      syntaxHighlighting(zequelHighlightStyle),
      EditorView.lineWrapping,
    ],
    [language]
  )

  const handleUpdate = (update: ViewUpdate) => {
    if (!onCursorChange) return
    if (update.selectionSet || update.docChanged) {
      const pos = update.state.selection.main.head
      const line = update.state.doc.lineAt(pos)
      onCursorChange({ line: line.number, col: pos - line.from + 1 })
    }
  }

  return (
    <CodeMirror
      value={value}
      height="100%"
      extensions={extensions}
      onChange={onChange}
      onUpdate={handleUpdate}
      onCreateEditor={(view) => {
        viewRef.current = view
        applyReveal()
      }}
      readOnly={readOnly}
      basicSetup={{
        lineNumbers: true,
        highlightActiveLine: true,
        highlightActiveLineGutter: true,
        foldGutter: true,
        autocompletion: true,
        bracketMatching: true,
        closeBrackets: true,
        indentOnInput: true,
        tabSize: 2,
      }}
      className="h-full text-[13px]"
    />
  )
}
