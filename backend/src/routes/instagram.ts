import { randomBytes, timingSafeEqual } from 'node:crypto'
import { Hono, type Context } from 'hono'
import { deleteCookie, getSignedCookie, setSignedCookie } from 'hono/cookie'
import { buildAuthorizeUrl, InstagramApiError } from '../instagram/api.js'
import {
  connectAccount,
  getCurrentAccount,
  InstagramAccountConflictError,
  InstagramReconnectRequiredError,
  listReels,
  REELS_STALE_AFTER_MS,
  syncReels,
  toAccountDto,
} from '../instagram/service.js'
import { requireAuth, type AuthEnv } from '../session.js'

export const instagramRoutes = new Hono<AuthEnv>()

instagramRoutes.use('*', requireAuth)

// The OAuth `state` lives in a signed, HttpOnly cookie bound to the user who
// started the flow, valid for 10 minutes. Path is `/` because the browser may
// reach this API under a proxy prefix (the frontend's `/api/*` rewrite), so a
// path scoped to `/instagram/connect` would never be sent back.
const STATE_COOKIE = 'ig_oauth_state'
const stateCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'Lax',
  path: '/',
} as const

function getStateSecret() {
  const secret = process.env.OAUTH_STATE_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('OAUTH_STATE_SECRET must be set to a random string of at least 32 characters')
  }
  return secret
}

function safeEqual(a: string, b: string) {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB)
}

/** Maps service errors to responses; anything unexpected is logged and hidden. */
function handleError(c: Context, err: unknown, fallback: string) {
  if (err instanceof InstagramReconnectRequiredError) {
    return c.json({ error: err.message, reconnect: true }, 409)
  }
  if (err instanceof InstagramAccountConflictError) {
    return c.json({ error: err.message }, 409)
  }
  if (err instanceof InstagramApiError) {
    console.error('Instagram API error:', err.status, err.code, err.message)
    return c.json({ error: fallback }, 502)
  }
  console.error(err)
  return c.json({ error: fallback }, 500)
}

instagramRoutes.post('/connect/start', async (c) => {
  try {
    const state = randomBytes(32).toString('base64url')
    await setSignedCookie(c, STATE_COOKIE, `${state}.${c.get('user').id}`, getStateSecret(), {
      ...stateCookieOptions,
      maxAge: 10 * 60,
    })
    return c.json({ authorizeUrl: buildAuthorizeUrl(state) })
  } catch (err) {
    return handleError(c, err, "Couldn't start the Instagram connection. Please try again.")
  }
})

instagramRoutes.post('/connect/callback', async (c) => {
  const body = (await c.req.json().catch(() => null)) as { code?: unknown; state?: unknown } | null
  const code = body?.code
  const state = body?.state
  if (typeof code !== 'string' || typeof state !== 'string') {
    return c.json({ error: 'code and state are required' }, 400)
  }

  const userId = c.get('user').id
  let cookie: string | false | undefined
  try {
    cookie = await getSignedCookie(c, getStateSecret(), STATE_COOKIE)
  } catch (err) {
    return handleError(c, err, "Couldn't complete the Instagram connection. Please try again.")
  }
  // Single use, whatever the outcome.
  deleteCookie(c, STATE_COOKIE, stateCookieOptions)

  const [expectedState, stateUserId] = cookie ? cookie.split('.') : []
  if (!expectedState || stateUserId !== userId || !safeEqual(state, expectedState)) {
    return c.json({ error: 'This connection attempt expired or is invalid. Please try again.' }, 400)
  }

  let account
  try {
    account = await connectAccount(userId, code)
  } catch (err) {
    return handleError(c, err, "Instagram couldn't complete the connection. Please try again.")
  }

  // Pull the reels right away so the home page has them. The account is
  // connected either way; a failed sync is retried on the next reels request.
  try {
    await syncReels(account)
  } catch (err) {
    console.error('Initial reels sync failed:', err)
  }

  return c.json({ account: toAccountDto(account) })
})

instagramRoutes.get('/account', async (c) => {
  try {
    const account = await getCurrentAccount(c.get('user').id)
    return c.json({ account: account ? toAccountDto(account) : null })
  } catch (err) {
    return handleError(c, err, "Couldn't load your Instagram account.")
  }
})

async function reelsResponse(c: Context<AuthEnv>, { forceSync }: { forceSync: boolean }) {
  try {
    const account = await getCurrentAccount(c.get('user').id)
    if (!account) {
      return c.json({ error: 'No Instagram account is connected.' }, 404)
    }

    const isStale =
      !account.lastSyncedAt || Date.now() - account.lastSyncedAt.getTime() > REELS_STALE_AFTER_MS
    let syncError: string | null = null

    if (forceSync || (isStale && account.status === 'active')) {
      try {
        await syncReels(account)
      } catch (err) {
        // A forced sync reports failure; a background refresh falls back to
        // the reels already stored.
        if (forceSync || err instanceof InstagramReconnectRequiredError) throw err
        console.error('Reels sync failed, serving cached reels:', err)
        syncError = "Couldn't refresh from Instagram; showing the last synced reels."
      }
    }

    const current = (await getCurrentAccount(c.get('user').id)) ?? account
    return c.json({
      account: toAccountDto(current),
      reels: await listReels(current),
      syncError,
    })
  } catch (err) {
    return handleError(c, err, "Couldn't load your reels from Instagram.")
  }
}

instagramRoutes.get('/reels', (c) => reelsResponse(c, { forceSync: false }))

instagramRoutes.post('/reels/sync', (c) => reelsResponse(c, { forceSync: true }))
