/** @type {import('next').NextConfig} */
const nextConfig = {
  // Workspace packages ship raw TypeScript/TSX and must be transpiled by Next.
  transpilePackages: ["@zequel/ui", "@zequel/shared", "@zequel/types"],
  typescript: {
    ignoreBuildErrors: true,
  },
  // Headless Chromium for PDF export must stay a real node_module so its
  // compressed binary is traced into the serverless function bundle.
  serverExternalPackages: ["@sparticuz/chromium", "playwright-core", "pdf-parse"],
  outputFileTracingIncludes: {
    "/api/export/pdf": ["../../node_modules/.pnpm/@sparticuz+chromium@*/node_modules/@sparticuz/chromium/bin/**"],
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
