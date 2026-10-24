import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { ThemeProvider } from '@zequel/ui/components/theme-provider'
import './globals.css'

const _geist = Geist({ subsets: ['latin'] })
const _geistMono = Geist_Mono({ subsets: ['latin'] })

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL 
  ? `https://${process.env.VERCEL_URL}` 
  : 'http://localhost:3000'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'Zequel — Research System',
  description:
    'Structured research workspace for evidence-backed reasoning, multi-document analysis, and traceable synthesis. Developed by Absalex Labs.',
  manifest: '/manifest.json',
  icons: {
    icon: '/zequel-logo-new.png',
    apple: '/zequel-logo-new.png',
  },
  openGraph: {
    title: 'Zequel — Research System',
    description:
      'Structured research workspace for evidence-backed reasoning, multi-document analysis, and traceable synthesis.',
    images: [
      {
        url: '/zequel-logo-new.png',
        width: 1080,
        height: 1080,
        alt: 'Zequel',
      },
    ],
    siteName: 'Zequel',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Zequel — Research System',
    description:
      'Structured research workspace for evidence-backed reasoning, multi-document analysis, and traceable synthesis.',
    images: ['/zequel-logo-new.png'],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Zequel',
  },
  applicationName: 'Zequel',
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FFFFFF' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css"
          crossOrigin="anonymous"
        />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/styles/github-dark.min.css"
          crossOrigin="anonymous"
        />
      </head>
      <body className="font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
