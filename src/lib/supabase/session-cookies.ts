export const REMEMBER_ME_COOKIE = "sb-remember-me";

/** Keep Supabase auth cookies as browser-session cookies when Remember me is off. */
export function applyRememberMeLifetime<T extends { maxAge?: number; expires?: Date }>(
  options: T,
  rememberMe: boolean,
): T {
  if (rememberMe) return options;

  const sessionOptions = { ...options };
  delete sessionOptions.maxAge;
  delete sessionOptions.expires;
  return sessionOptions;
}
