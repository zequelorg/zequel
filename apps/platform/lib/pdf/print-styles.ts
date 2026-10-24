/**
 * Print stylesheet for exported AI responses. It targets the semantic HTML that
 * MarkdownRenderer produces, so the PDF keeps the in-app hierarchy without
 * shipping the full Tailwind bundle to the headless browser.
 */
export const PRINT_STYLES = /* css */ `
@page {
  size: A4;
  margin: 18mm 16mm 20mm 16mm;
}

:root {
  --foreground: #000000;
  --muted-foreground: #444444;
  --border: #E5E5E5;
  --secondary: #F5F5F5;
  --code-bg: #FAFAFA;
  --code-fg: #1F2328;
  --code-comment: #6E7781;
  --code-keyword: #CF222E;
  --code-string: #0A3069;
  --code-number: #0550AE;
  --code-function: #8250DF;
  --code-type: #953800;
}

* { box-sizing: border-box; }

html, body {
  margin: 0;
  padding: 0;
  background: #FFFFFF;
  color: var(--foreground);
  font-family: 'Geist', 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
  font-size: 10.5pt;
  line-height: 1.7;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

.doc-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding-bottom: 10pt;
  margin-bottom: 18pt;
  border-bottom: 1px solid var(--border);
}

.doc-brand {
  font-family: 'Geist Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 8pt;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.doc-meta {
  font-family: 'Geist Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 7.5pt;
  color: var(--muted-foreground);
}

.doc-body { word-break: break-word; overflow-wrap: break-word; }

h1, h2, h3, h4, h5, h6 {
  color: var(--foreground);
  break-after: avoid-page;
  page-break-after: avoid;
  break-inside: avoid;
}
h1 { font-size: 17pt; font-weight: 700; letter-spacing: -0.02em; margin: 18pt 0 9pt; line-height: 1.3; }
h2 { font-size: 14pt; font-weight: 600; letter-spacing: -0.015em; margin: 16pt 0 7pt; line-height: 1.35; }
h3 { font-size: 12pt; font-weight: 600; margin: 13pt 0 5pt; line-height: 1.4; }
h4, h5, h6 { font-size: 10.5pt; font-weight: 600; margin: 11pt 0 4pt; }
.doc-body > :first-child { margin-top: 0 !important; }

/* Keep a heading with at least the first lines of what follows it. */
h1 + *, h2 + *, h3 + *, h4 + * { break-before: avoid-page; page-break-before: avoid; }

p { margin: 0 0 8pt; orphans: 3; widows: 3; }

ul, ol { margin: 0 0 8pt; padding-left: 18pt; }
li { margin: 0 0 3pt; padding-left: 2pt; }
li::marker { color: var(--muted-foreground); }
li > p { margin: 0; }

strong { font-weight: 600; }
em { font-style: italic; }

a { color: var(--foreground); text-decoration: underline; text-decoration-color: rgba(0,0,0,0.35); text-underline-offset: 3px; word-break: break-all; }

hr { border: 0; border-top: 1px solid var(--border); margin: 16pt 0; }

blockquote {
  margin: 0 0 10pt;
  padding: 6pt 10pt;
  border-left: 3px solid rgba(0,0,0,0.2);
  background: rgba(245,245,245,0.6);
  color: var(--muted-foreground);
  break-inside: avoid;
}
blockquote > p { margin: 0; }

img { max-width: 100%; height: auto; break-inside: avoid; }

/* Inline code */
:not(pre) > code {
  font-family: 'Geist Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 9pt;
  background: var(--secondary);
  border-radius: 4px;
  padding: 1pt 4pt;
  word-break: break-all;
}

/* Code block (CodeBlock component: wrapper > header bar > pre) */
.group\\/code {
  margin: 0 0 10pt;
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow: hidden;
}
.group\\/code > div:first-child {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4pt 10pt;
  background: var(--secondary);
  border-bottom: 1px solid var(--border);
  break-after: avoid-page;
}
.group\\/code > div:first-child span {
  font-family: 'Geist Mono', ui-monospace, monospace;
  font-size: 7pt;
  font-weight: 500;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted-foreground);
}
.group\\/code button { display: none; }

pre {
  margin: 0;
  padding: 8pt 10pt;
  font-family: 'Geist Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 8.5pt;
  line-height: 1.55;
  background: var(--code-bg);
  color: var(--code-fg);
  /* Wrap long lines instead of clipping them off the page. */
  white-space: pre-wrap;
  word-break: break-word;
  overflow: visible;
}
pre code { font: inherit; background: transparent; padding: 0; }
pre code > span { break-inside: avoid; }

.hljs-comment, .hljs-quote, .hljs-meta { color: var(--code-comment); font-style: italic; }
.hljs-keyword, .hljs-selector-tag, .hljs-literal, .hljs-doctag, .hljs-deletion { color: var(--code-keyword); }
.hljs-string, .hljs-regexp, .hljs-addition, .hljs-template-tag { color: var(--code-string); }
.hljs-number, .hljs-attr, .hljs-attribute, .hljs-variable, .hljs-symbol, .hljs-bullet { color: var(--code-number); }
.hljs-title, .hljs-section, .hljs-name { color: var(--code-function); }
.hljs-type, .hljs-built_in, .hljs-params, .hljs-selector-class { color: var(--code-type); }
.hljs-title.class_ { color: var(--code-type); }

/* Tables: repeat headers on every page and never split a row. */
.doc-body div:has(> table) {
  margin: 0 0 10pt;
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow: hidden;
}
table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
thead { display: table-header-group; background: rgba(245,245,245,0.8); }
tr { break-inside: avoid; page-break-inside: avoid; }
th {
  text-align: left;
  padding: 5pt 8pt;
  font-family: 'Geist Mono', ui-monospace, monospace;
  font-size: 7.5pt;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted-foreground);
  border-bottom: 1px solid var(--border);
}
td { padding: 5pt 8pt; border-bottom: 1px solid rgba(229,229,229,0.6); vertical-align: top; }
tr:last-child td { border-bottom: 0; }

/* Math */
.katex { font-size: 1.08em; }
.katex-display { margin: 8pt 0; overflow: visible; break-inside: avoid; }
.katex .mord, .katex .mbin, .katex .mrel, .katex .mopen,
.katex .mclose, .katex .mpunct, .katex .mop { color: var(--foreground); }
`
