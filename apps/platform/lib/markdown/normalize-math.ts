/**
 * Models frequently emit LaTeX with \( ... \) and \[ ... \] delimiters, which
 * remark-math does not recognise, so the raw commands leaked into the chat.
 * Convert them to $ / $$ delimiters while leaving code spans and fences untouched.
 */
const CODE_SEGMENT = /(```[\s\S]*?(?:```|$)|~~~[\s\S]*?(?:~~~|$)|`[^`\n]*`)/g

function convertDelimiters(text: string): string {
  return text
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, expr: string) => `\n$$\n${expr.trim()}\n$$\n`)
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, expr: string) => `$${expr.trim()}$`)
    .replace(
      /\\begin\{(equation\*?|align\*?|gather\*?|alignat\*?|matrix|pmatrix|bmatrix|vmatrix|Vmatrix|cases)\}([\s\S]+?)\\end\{\1\}/g,
      (_, env: string, content: string) => {
        return `\n$$\n\\begin{${env}}${content}\\end{${env}}\n$$\n`
      }
    )
    .replace(/\$\$([^\n$][^$]*?)\$\$/g, (match, expr: string, offset: number, source: string) => {
      // Promote single-line $$x$$ that sits alone on its line to display math.
      const before = source.slice(Math.max(0, offset - 1), offset)
      const after = source.slice(offset + match.length, offset + match.length + 1)
      const standalone = (before === '' || before === '\n') && (after === '' || after === '\n')
      return standalone ? `$$\n${expr.trim()}\n$$` : match
    })
}

export function normalizeMath(markdown: string): string {
  if (
    !markdown ||
    (!markdown.includes('\\(') &&
      !markdown.includes('\\[') &&
      !markdown.includes('$$') &&
      !markdown.includes('\\begin{') &&
      !markdown.includes('$'))
  ) {
    return markdown
  }
  return markdown
    .split(CODE_SEGMENT)
    .map((segment, index) => (index % 2 === 1 ? segment : convertDelimiters(segment)))
    .join('')
}
