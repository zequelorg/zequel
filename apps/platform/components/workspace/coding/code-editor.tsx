'use client'

import { useMemo } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { EditorView, ViewUpdate } from '@codemirror/view'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'
import { useCodingIdeStore } from '@/lib/coding/coding-ide-store'
import { javascript } from '@codemirror/lang-javascript'
import { python } from '@codemirror/lang-python'
import { html } from '@codemirror/lang-html'
import { css } from '@codemirror/lang-css'
import { java } from '@codemirror/lang-java'
import { cpp } from '@codemirror/lang-cpp'
import { sql } from '@codemirror/lang-sql'
import type { Extension } from '@codemirror/state'
import type { CodingLanguage } from '@zequel/types'

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
// and friends are defined in globals.css for both :root (light) and .dark, and
// are the same tokens the chat's markdown code blocks use (`.zequel-code`) —
// so the editor automatically tracks the app's active theme instead of being
// stuck on one hardcoded palette.
const zequelEditorTheme = EditorView.theme({
  '&': {
    backgroundColor: 'var(--code-bg)',
    color: 'var(--code-fg)',
    height: '100%',
    fontSize: '13px',
  },
  '.cm-content': {
    fontFamily:
      'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)',
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
    backgroundColor:
      'color-mix(in srgb, var(--code-fg) 15%, transparent) !important',
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
    fontFamily:
      'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)',
    lineHeight: '1.6',
  },
})

// Syntax token colors — mapped to the exact same --code-keyword / --code-string
// / --code-number / --code-function / --code-type / --code-comment tokens the
// chat's markdown code blocks use, so a snippet looks the same whether it's
// rendered in a chat message or open in the editor.
const zequelHighlightStyle = HighlightStyle.define([
  { tag: [t.comment, t.lineComment, t.blockComment], color: 'var(--code-comment)', fontStyle: 'italic' },
  { tag: [t.keyword, t.controlKeyword, t.moduleKeyword, t.operatorKeyword, t.bool, t.null], color: 'var(--code-keyword)' },
  { tag: [t.string, t.special(t.string), t.regexp], color: 'var(--code-string)' },
  { tag: [t.number, t.integer, t.float, t.attributeName], color: 'var(--code-number)' },
  { tag: [t.function(t.variableName), t.function(t.propertyName), t.className, t.labelName], color: 'var(--code-function)' },
  { tag: [t.typeName, t.namespace, t.tagName], color: 'var(--code-type)' },
  { tag: t.invalid, color: 'var(--destructive)' },
])

interface CodeEditorProps {
  value: string
  language: CodingLanguage
  onChange: (value: string) => void
  readOnly?: boolean
}

export function CodeEditor({ value, language, onChange, readOnly }: CodeEditorProps) {
  const { setCursorPosition } = useCodingIdeStore()

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
    if (update.selectionSet || update.docChanged) {
      const pos = update.state.selection.main.head
      const line = update.state.doc.lineAt(pos)
      setCursorPosition({
        line: line.number,
        col: pos - line.from + 1,
      })
    }
  }

  return (
    <CodeMirror
      value={value}
      height="100%"
      extensions={extensions}
      onChange={onChange}
      onUpdate={handleUpdate}
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
