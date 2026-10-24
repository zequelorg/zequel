import 'server-only'
import type { Browser } from 'playwright-core'

/**
 * Only stylesheet/font hosts may be fetched while rendering. Everything else
 * (including markdown images pointing at internal addresses) is aborted so the
 * renderer cannot be used for SSRF.
 */
const ALLOWED_HOSTS = new Set(['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'])

/**
 * Root cause of the "PDF generation failed" errors: @sparticuz/chromium only
 * extracts its bundled NSS/NSPR shared libraries (libnspr4.so, libnss3.so, …)
 * and wires up LD_LIBRARY_PATH when it believes it is running on Amazon Linux
 * 2023. That check reads AWS_EXECUTION_ENV / AWS_LAMBDA_JS_RUNTIME /
 * CODEBUILD_BUILD_IMAGE / VERCEL. When none of those advertise a Node 20/22
 * AL2023 runtime, the libraries are never laid down and Chromium dies on launch
 * with "libnspr4.so: cannot open shared object file".
 *
 * We advertise a compatible runtime *before* the package is imported (it wires
 * up LD_LIBRARY_PATH at module-eval time), which forces the libraries to be
 * extracted. This is a no-op when the environment already signals AL2023.
 */
function ensureChromiumLibraries(): void {
  const signalsAl2023 =
    /20\.x|22\.x/.test(process.env.AWS_EXECUTION_ENV ?? '') ||
    /20\.x|22\.x/.test(process.env.AWS_LAMBDA_JS_RUNTIME ?? '') ||
    /nodejs20|nodejs22/.test(process.env.CODEBUILD_BUILD_IMAGE ?? '') ||
    (Boolean(process.env.VERCEL) && Number.parseInt(process.versions.node, 10) >= 20)

  if (!signalsAl2023) {
    const major = Number.parseInt(process.versions.node, 10)
    process.env.AWS_LAMBDA_JS_RUNTIME = `nodejs${major >= 22 ? 22 : 20}.x`
  }
}

async function launchBrowser(): Promise<Browser> {
  const { chromium } = await import('playwright-core')
  const localPath = process.env.CHROMIUM_EXECUTABLE_PATH
  if (localPath) {
    return chromium.launch({ executablePath: localPath, headless: true })
  }
  ensureChromiumLibraries()
  const sparticuz = (await import('@sparticuz/chromium')).default
  return chromium.launch({
    executablePath: await sparticuz.executablePath(),
    args: sparticuz.args,
    headless: true,
  })
}

export async function htmlToPdf(html: string): Promise<Buffer> {
  const browser = await launchBrowser()
  try {
    const context = await browser.newContext()
    const page = await context.newPage()

    await page.route('**/*', (route) => {
      try {
        const url = new URL(route.request().url())
        if (
          url.protocol === 'data:' ||
          url.protocol === 'about:' ||
          (url.protocol === 'https:' && ALLOWED_HOSTS.has(url.hostname))
        ) {
          return route.continue()
        }
      } catch {
        // Fall through to abort
      }
      return route.abort()
    })

    await page.setContent(html, { waitUntil: 'load', timeout: 15_000 })
    await page.emulateMedia({ media: 'print' })

    // Wait for KaTeX/Geist webfonts to finish loading so LaTeX math glyphs render cleanly
    await page.evaluate(() => document.fonts?.ready).catch(() => {})

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: `<div style="width:100%;font-family:ui-monospace,monospace;font-size:7px;color:#888;text-align:center;">
        <span class="pageNumber"></span> / <span class="totalPages"></span></div>`,
    })
    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}
