import type { Context, MiddlewareHandler } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import type { Session, User } from '@supabase/supabase-js'
import { getUserFromToken, refreshSession } from './auth.js'

export const ACCESS_COOKIE = 'sb_access'
export const REFRESH_COOKIE = 'sb_refresh'

const REFRESH_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

// HttpOnly keeps both tokens out of reach of page scripts (XSS can't read
// them); SameSite=Lax stops the browser attaching them to cross-site POSTs.
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'Lax',
  path: '/',
} as const

export type AuthEnv = { Variables: { user: User } }

export function setSessionCookies(c: Context, session: Session) {
  setCookie(c, ACCESS_COOKIE, session.access_token, { ...cookieOptions, maxAge: session.expires_in })
  setCookie(c, REFRESH_COOKIE, session.refresh_token, { ...cookieOptions, maxAge: REFRESH_MAX_AGE })
}

export function clearSessionCookies(c: Context) {
  deleteCookie(c, ACCESS_COOKIE, cookieOptions)
  deleteCookie(c, REFRESH_COOKIE, cookieOptions)
}

/**
 * Resolves the user from the session cookies. If the access token is missing
 * or expired, silently refreshes it with the refresh token and re-sets both
 * cookies, so the frontend never has to handle tokens itself.
 */
export async function getSessionUser(c: Context): Promise<User | null> {
  const accessToken = getCookie(c, ACCESS_COOKIE)
  if (accessToken) {
    const user = await getUserFromToken(accessToken)
    if (user) return user
  }

  const refreshToken = getCookie(c, REFRESH_COOKIE)
  if (!refreshToken) return null

  const { data, error } = await refreshSession(refreshToken)
  if (error || !data.session || !data.user) {
    clearSessionCookies(c)
    return null
  }

  setSessionCookies(c, data.session)
  return data.user
}

/** Rejects the request with 401 unless it carries a valid session; exposes `c.get('user')`. */
export const requireAuth: MiddlewareHandler<AuthEnv> = async (c, next) => {
  const user = await getSessionUser(c)
  if (!user) {
    return c.json({ user: null }, 401)
  }
  c.set('user', user)
  await next()
}
