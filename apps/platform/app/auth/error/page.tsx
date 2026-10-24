import { ZequelLogoFull } from '@zequel/ui/components/zequel-logo'
import Link from 'next/link'

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error: string }>
}) {
  const params = await searchParams

  return (
    <div className="flex min-h-svh w-full items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm text-center">
        <div className="mb-12">
          <ZequelLogoFull className="inline-block" />
        </div>

        <div className="flex flex-col gap-4">
          <h2 className="font-mono text-sm font-semibold uppercase tracking-wider text-foreground">
            Authentication Error
          </h2>
          {params?.error ? (
            <p className="font-mono text-xs text-muted-foreground">
              {'Error: '}{params.error}
            </p>
          ) : (
            <p className="font-mono text-xs text-muted-foreground">
              An unspecified error occurred.
            </p>
          )}
          <div className="mt-6">
            <Link
              href="/login"
              className="font-mono text-xs text-foreground underline underline-offset-4"
            >
              Return to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
