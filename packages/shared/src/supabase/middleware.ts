import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

type CookieToSet = { name: string; value: string; options?: CookieOptions }

export interface UpdateSessionOptions {
  /**
   * Path prefixes that require an authenticated user. Defaults to the
   * platform's protected areas.
   */
  protectedPaths?: string[]
  /**
   * Where to send unauthenticated users. May be an in-app path (e.g. "/login")
   * or an absolute URL to another app (e.g. "https://app.zequel.xyz/login").
   */
  loginUrl?: string
  /**
   * When true, the originally requested path is attached as a `redirect`
   * search param so the login flow can return the user afterwards.
   */
  attachRedirectParam?: boolean
}

export async function updateSession(
  request: NextRequest,
  options: UpdateSessionOptions = {},
) {
  const {
    protectedPaths = ['/workspace', '/settings'],
    loginUrl = '/login',
    attachRedirectParam = false,
  } = options

  let supabaseResponse = NextResponse.next({
    request,
  })

  // With Fluid compute, don't put this client in a global environment
  // variable. Always create a new one on each request.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // Do not run code between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  // IMPORTANT: If you remove getUser() and you use server-side rendering
  // with the Supabase client, your users may be randomly logged out.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isProtected = protectedPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path),
  )

  if (isProtected && !user) {
    // no user, redirect to the configured login destination
    if (loginUrl.startsWith('http')) {
      const url = new URL(loginUrl)
      if (attachRedirectParam) {
        url.searchParams.set('redirect', request.nextUrl.pathname)
      }
      return NextResponse.redirect(url)
    }
    const url = request.nextUrl.clone()
    url.pathname = loginUrl
    if (attachRedirectParam) {
      url.searchParams.set('redirect', request.nextUrl.pathname)
    }
    return NextResponse.redirect(url)
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  // If you're creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return supabaseResponse
}
