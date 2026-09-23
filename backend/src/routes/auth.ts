import { Hono, type Context } from 'hono'
import { getCookie } from 'hono/cookie'
import { refreshSession, revokeSession, signInWithPassword, signUpWithPassword } from '../auth.js'
import {
  ACCESS_COOKIE,
  clearSessionCookies,
  requireAuth,
  setSessionCookies,
  type AuthEnv,
} from '../session.js'

export const authRoutes = new Hono<AuthEnv>()

async function readCredentials(c: Context) {
  const body = (await c.req.json().catch(() => null)) as { email?: unknown; password?: unknown } | null
  const email = body?.email
  const password = body?.password
  if (typeof email !== 'string' || typeof password !== 'string') return null
  return { email, password }
}

authRoutes.get('/session', requireAuth, (c) => {
  return c.json({ user: c.get('user') })
})

authRoutes.post('/signup', async (c) => {
  const credentials = await readCredentials(c)
  if (!credentials) {
    return c.json({ error: 'email and password are required' }, 400)
  }

  const { data, error } = await signUpWithPassword(credentials.email, credentials.password)
  if (error) {
    return c.json({ error: error.message }, 400)
  }

  // No session means Supabase is waiting on email confirmation.
  if (data.session) {
    setSessionCookies(c, data.session)
  }

  return c.json({ user: data.user, authenticated: Boolean(data.session) })
})

authRoutes.post('/login', async (c) => {
  const credentials = await readCredentials(c)
  if (!credentials) {
    return c.json({ error: 'email and password are required' }, 400)
  }

  const { data, error } = await signInWithPassword(credentials.email, credentials.password)
  if (error || !data.session) {
    return c.json({ error: error?.message ?? 'Invalid login credentials' }, 401)
  }

  setSessionCookies(c, data.session)
  return c.json({ user: data.user, authenticated: true })
})

/**
 * Turns the refresh token from Supabase's email-confirmation redirect
 * (delivered to the browser in the URL fragment) into session cookies.
 * Refreshing it both validates the token and rotates it, so the one that
 * passed through the URL is immediately dead.
 */
authRoutes.post('/exchange', async (c) => {
  const body = (await c.req.json().catch(() => null)) as { refresh_token?: unknown } | null
  const refreshToken = body?.refresh_token
  if (typeof refreshToken !== 'string') {
    return c.json({ error: 'refresh_token is required' }, 400)
  }

  const { data, error } = await refreshSession(refreshToken)
  if (error || !data.session) {
    return c.json({ error: error?.message ?? 'Invalid or expired link' }, 401)
  }

  setSessionCookies(c, data.session)
  return c.json({ user: data.user, authenticated: true })
})

authRoutes.post('/logout', async (c) => {
  const accessToken = getCookie(c, ACCESS_COOKIE)
  if (accessToken) {
    // Best effort: the cookies are cleared either way.
    await revokeSession(accessToken).catch(() => null)
  }

  clearSessionCookies(c)
  return c.json({ ok: true })
})
