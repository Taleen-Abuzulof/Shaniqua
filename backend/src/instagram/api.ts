// Thin client for the Instagram API with Instagram Login (graph.instagram.com).
// Nothing here touches the database; see ./service.ts for that.

const REQUEST_TIMEOUT_MS = 10_000

export const INSTAGRAM_SCOPES = [
  'instagram_business_basic',
  'instagram_business_manage_comments',
  'instagram_business_manage_messages',
]

type InstagramConfig = {
  appId: string
  appSecret: string
  redirectUri: string
  graphVersion: string
}

// Read lazily so the rest of the API still boots before Instagram is configured.
function getConfig(): InstagramConfig {
  const appId = process.env.INSTAGRAM_APP_ID
  const appSecret = process.env.INSTAGRAM_APP_SECRET
  if (!appId || !appSecret) {
    throw new Error('INSTAGRAM_APP_ID and INSTAGRAM_APP_SECRET must be set')
  }
  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000'
  return {
    appId,
    appSecret,
    redirectUri: process.env.INSTAGRAM_REDIRECT_URI ?? `${frontendUrl}/connect/instagram/callback`,
    graphVersion: process.env.INSTAGRAM_GRAPH_VERSION ?? 'v25.0',
  }
}

export class InstagramApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: number,
  ) {
    super(message)
    this.name = 'InstagramApiError'
  }

  /** Token expired, revoked, or the user removed the app: they must reconnect. */
  get isAuthError() {
    return this.code === 190 || this.status === 401
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
  const body = (await res.json().catch(() => null)) as Record<string, any> | null

  if (!res.ok || !body || body.error || body.error_message) {
    // Graph errors: { error: { message, code } }. OAuth errors: { error_message, code }.
    const message = body?.error?.message ?? body?.error_message ?? `Instagram API request failed (${res.status})`
    const code = body?.error?.code ?? body?.code
    throw new InstagramApiError(message, res.status, typeof code === 'number' ? code : undefined)
  }

  return body as T
}

function graphUrl(path: string, params: Record<string, string>) {
  const { graphVersion } = getConfig()
  const url = new URL(`https://graph.instagram.com/${graphVersion}${path}`)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  return url.toString()
}

export function buildAuthorizeUrl(state: string) {
  const { appId, redirectUri } = getConfig()
  const url = new URL('https://www.instagram.com/oauth/authorize')
  url.searchParams.set('client_id', appId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', INSTAGRAM_SCOPES.join(','))
  url.searchParams.set('state', state)
  return url.toString()
}

type ShortLivedToken = { access_token: string; user_id: string | number; permissions?: string | string[] }

/** Exchanges the OAuth `code` for a short-lived (1 hour) access token. */
export async function exchangeCodeForToken(code: string) {
  const { appId, appSecret, redirectUri } = getConfig()
  const body = await request<ShortLivedToken | { data: ShortLivedToken[] }>(
    'https://api.instagram.com/oauth/access_token',
    {
      method: 'POST',
      body: new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code,
      }),
    },
  )

  // Documented as `{ data: [...] }`, but has also been returned flat.
  const token = 'data' in body ? body.data[0] : body
  if (!token?.access_token) {
    throw new InstagramApiError('Instagram did not return an access token', 502)
  }

  const permissions = Array.isArray(token.permissions)
    ? token.permissions
    : (token.permissions ?? '').split(',').filter(Boolean)

  return { accessToken: token.access_token, permissions }
}

type LongLivedToken = { access_token: string; expires_in: number }

function toLongLived(body: LongLivedToken) {
  return {
    accessToken: body.access_token,
    expiresAt: new Date(Date.now() + body.expires_in * 1000),
  }
}

/** Exchanges a short-lived token for a long-lived (60 day) one. */
export async function exchangeForLongLivedToken(shortLivedToken: string) {
  const { appSecret } = getConfig()
  const url = new URL('https://graph.instagram.com/access_token')
  url.searchParams.set('grant_type', 'ig_exchange_token')
  url.searchParams.set('client_secret', appSecret)
  url.searchParams.set('access_token', shortLivedToken)
  return toLongLived(await request<LongLivedToken>(url.toString()))
}

/** Extends a long-lived token (must be at least 24 hours old and unexpired). */
export async function refreshLongLivedToken(accessToken: string) {
  const url = new URL('https://graph.instagram.com/refresh_access_token')
  url.searchParams.set('grant_type', 'ig_refresh_token')
  url.searchParams.set('access_token', accessToken)
  return toLongLived(await request<LongLivedToken>(url.toString()))
}

export type InstagramProfile = {
  // Professional account ID: what webhooks and the messaging API use.
  user_id: string
  username: string
  name?: string
  profile_picture_url?: string
  account_type?: string
}

export async function getProfile(accessToken: string) {
  return request<InstagramProfile>(
    graphUrl('/me', {
      fields: 'user_id,username,name,profile_picture_url,account_type',
      access_token: accessToken,
    }),
  )
}

export type InstagramMedia = {
  id: string
  caption?: string
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM'
  media_product_type: 'FEED' | 'REELS' | 'STORY' | 'AD'
  media_url?: string
  thumbnail_url?: string
  permalink: string
  timestamp: string
  like_count?: number
  comments_count?: number
}

type MediaPage = { data: InstagramMedia[]; paging?: { next?: string } }

const MEDIA_FIELDS = [
  'id',
  'caption',
  'media_type',
  'media_product_type',
  'media_url',
  'thumbnail_url',
  'permalink',
  'timestamp',
  'like_count',
  'comments_count',
].join(',')

/** Lists the account's media, newest first, following pagination up to `maxPages`. */
export async function listMedia(accessToken: string, { pageSize = 50, maxPages = 10 } = {}) {
  const media: InstagramMedia[] = []
  let url: string | undefined = graphUrl('/me/media', {
    fields: MEDIA_FIELDS,
    limit: String(pageSize),
    access_token: accessToken,
  })

  for (let page = 0; url && page < maxPages; page++) {
    const body: MediaPage = await request<MediaPage>(url)
    media.push(...body.data)
    url = body.paging?.next
  }

  return media
}
