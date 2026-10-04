import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { applyRememberMeLifetime, REMEMBER_ME_COOKIE } from './session-cookies'

/**
 * If using Fluid compute: Don't put this client in a global variable. Always create a new client within each
 * function when using it.
 */

export async function createClient(options?: { rememberMe?: boolean }) {
  const cookieStore = await cookies()
  const rememberMe = options?.rememberMe ?? cookieStore.get(REMEMBER_ME_COOKIE)?.value !== 'session'

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, applyRememberMeLifetime(options, rememberMe))
            })
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}
