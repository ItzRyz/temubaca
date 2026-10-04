import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { applyRememberMeLifetime, REMEMBER_ME_COOKIE } from './session-cookies'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })
  // Missing marker means a legacy session; keep its existing persistent behavior.
  const rememberMe = request.cookies.get(REMEMBER_ME_COOKIE)?.value !== 'session'

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, applyRememberMeLifetime(options, rememberMe))
          )
        },
      },
    }
  )

  const { data } = await supabase.auth.getClaims()
  const user = data?.claims

  if (
    !user &&
    !request.nextUrl.pathname.startsWith('/login') &&
    !request.nextUrl.pathname.startsWith('/auth') &&
    request.nextUrl.pathname !== '/forgot-password' &&
    request.nextUrl.pathname !== '/verify-email' &&
    request.nextUrl.pathname !== '/oauth/consent'
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth'
    return NextResponse.redirect(url)
  }
  return supabaseResponse
}
