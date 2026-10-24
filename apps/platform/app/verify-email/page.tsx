import { ZequelLogoFull } from '@zequel/ui/components/zequel-logo'
import Link from 'next/link'

export default function SignUpSuccessPage() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm text-center">
        <div className="mb-12">
          <ZequelLogoFull className="inline-block" />
        </div>

        <div className="flex flex-col gap-4">
          <h2 className="font-mono text-sm font-semibold uppercase tracking-wider text-foreground">
            Account Created
          </h2>
          <p className="font-sans text-sm leading-relaxed text-muted-foreground">
            Your account has been verified. You can now sign in.
          </p>
          <div className="mt-6">
            <Link
              href="/login"
              className="font-mono text-xs text-foreground underline underline-offset-4"
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
