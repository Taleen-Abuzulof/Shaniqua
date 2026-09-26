import { and, desc, eq, ne, sql } from 'drizzle-orm'
import { decryptSecret, encryptSecret } from '../crypto.js'
import { db } from '../db/index.js'
import { igAccounts, media } from '../db/schema.js'
import {
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  getProfile,
  InstagramApiError,
  listMedia,
  refreshLongLivedToken,
} from './api.js'

type IgAccount = typeof igAccounts.$inferSelect

// Refresh the 60-day token once it has less than this left.
const TOKEN_REFRESH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000
// Instagram CDN media URLs are signed and expire, so re-sync periodically.
export const REELS_STALE_AFTER_MS = 60 * 60 * 1000

export class InstagramAccountConflictError extends Error {
  constructor() {
    super('This Instagram account is already connected to another Shaniqua user.')
    this.name = 'InstagramAccountConflictError'
  }
}

export class InstagramReconnectRequiredError extends Error {
  constructor() {
    super('Your Instagram connection has expired. Please reconnect your account.')
    this.name = 'InstagramReconnectRequiredError'
  }
}

/** Public shape of a connected account; never includes the token. */
export function toAccountDto(account: IgAccount) {
  return {
    id: account.id,
    igUserId: account.igUserId,
    username: account.username,
    name: account.name,
    profilePictureUrl: account.profilePictureUrl,
    status: account.status,
    lastSyncedAt: account.lastSyncedAt,
  }
}

/**
 * Completes the OAuth flow: exchanges the code for a long-lived token, reads
 * the profile, and creates or updates the user's `ig_accounts` row.
 */
export async function connectAccount(userId: string, code: string) {
  const shortLived = await exchangeCodeForToken(code)
  const longLived = await exchangeForLongLivedToken(shortLived.accessToken)
  const profile = await getProfile(longLived.accessToken)

  const values = {
    userId,
    igUserId: String(profile.user_id),
    username: profile.username,
    name: profile.name ?? null,
    profilePictureUrl: profile.profile_picture_url ?? null,
    accessTokenEncrypted: encryptSecret(longLived.accessToken),
    tokenExpiresAt: longLived.expiresAt,
    scopes: shortLived.permissions,
    status: 'active' as const,
  }

  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: igAccounts.id, userId: igAccounts.userId })
      .from(igAccounts)
      .where(eq(igAccounts.igUserId, values.igUserId))
      .for('update')

    if (existing && existing.userId !== userId) {
      throw new InstagramAccountConflictError()
    }

    if (existing) {
      const [updated] = await tx.update(igAccounts).set(values).where(eq(igAccounts.id, existing.id)).returning()
      return updated
    }

    const [created] = await tx.insert(igAccounts).values(values).returning()
    return created
  })
}

/** The user's most recently connected Instagram account that isn't disconnected. */
export async function getCurrentAccount(userId: string) {
  const [account] = await db
    .select()
    .from(igAccounts)
    .where(and(eq(igAccounts.userId, userId), ne(igAccounts.status, 'disconnected')))
    .orderBy(desc(igAccounts.updatedAt))
    .limit(1)
  return account ?? null
}

async function markTokenExpired(account: IgAccount) {
  await db.update(igAccounts).set({ status: 'token_expired' }).where(eq(igAccounts.id, account.id))
}

/**
 * Returns a usable access token for the account, extending it when it's
 * close to expiry. Throws InstagramReconnectRequiredError if it can't.
 */
async function getAccessToken(account: IgAccount) {
  if (account.status !== 'active') throw new InstagramReconnectRequiredError()

  const expiresAt = account.tokenExpiresAt?.getTime()
  if (expiresAt !== undefined && expiresAt <= Date.now()) {
    await markTokenExpired(account)
    throw new InstagramReconnectRequiredError()
  }

  const token = decryptSecret(account.accessTokenEncrypted)
  if (expiresAt === undefined || expiresAt - Date.now() > TOKEN_REFRESH_WINDOW_MS) {
    return token
  }

  try {
    const refreshed = await refreshLongLivedToken(token)
    await db
      .update(igAccounts)
      .set({ accessTokenEncrypted: encryptSecret(refreshed.accessToken), tokenExpiresAt: refreshed.expiresAt })
      .where(eq(igAccounts.id, account.id))
    return refreshed.accessToken
  } catch (err) {
    if (err instanceof InstagramApiError && err.isAuthError) {
      await markTokenExpired(account)
      throw new InstagramReconnectRequiredError()
    }
    // Refresh is best effort; the current token is still valid for a while.
    return token
  }
}

/** Upsert `set` clause taking each column's value from the row being inserted. */
function excluded<K extends string>(columns: Record<K, { name: string }>) {
  return Object.fromEntries(
    Object.entries<{ name: string }>(columns).map(([key, column]) => [key, sql.raw(`excluded."${column.name}"`)]),
  ) as Record<K, ReturnType<typeof sql.raw>>
}

/** Fetches the account's reels from Instagram and upserts them into `media`. */
export async function syncReels(account: IgAccount) {
  const token = await getAccessToken(account)

  let items
  try {
    items = await listMedia(token)
  } catch (err) {
    if (err instanceof InstagramApiError && err.isAuthError) {
      await markTokenExpired(account)
      throw new InstagramReconnectRequiredError()
    }
    throw err
  }

  const reels = items.filter((item) => item.media_product_type === 'REELS')
  const syncedAt = new Date()

  await db.transaction(async (tx) => {
    if (reels.length > 0) {
      await tx
        .insert(media)
        .values(
          reels.map((reel) => ({
            igAccountId: account.id,
            igMediaId: reel.id,
            mediaType: reel.media_type,
            mediaProductType: reel.media_product_type,
            caption: reel.caption ?? null,
            permalink: reel.permalink,
            mediaUrl: reel.media_url ?? null,
            thumbnailUrl: reel.thumbnail_url ?? null,
            postedAt: new Date(reel.timestamp),
            likeCount: reel.like_count ?? null,
            commentsCount: reel.comments_count ?? null,
            syncedAt,
          })),
        )
        .onConflictDoUpdate({
          target: media.igMediaId,
          set: excluded({
            caption: media.caption,
            permalink: media.permalink,
            mediaUrl: media.mediaUrl,
            thumbnailUrl: media.thumbnailUrl,
            likeCount: media.likeCount,
            commentsCount: media.commentsCount,
            syncedAt: media.syncedAt,
          }),
        })
    }
    await tx.update(igAccounts).set({ lastSyncedAt: syncedAt }).where(eq(igAccounts.id, account.id))
  })

  return reels.length
}

/** The account's synced reels, newest first. */
export async function listReels(account: IgAccount) {
  const rows = await db
    .select()
    .from(media)
    .where(and(eq(media.igAccountId, account.id), eq(media.mediaProductType, 'REELS')))
    .orderBy(desc(media.postedAt))

  return rows.map((row) => ({
    id: row.id,
    igMediaId: row.igMediaId,
    caption: row.caption,
    permalink: row.permalink,
    mediaUrl: row.mediaUrl,
    thumbnailUrl: row.thumbnailUrl,
    postedAt: row.postedAt,
    likeCount: row.likeCount,
    commentsCount: row.commentsCount,
  }))
}
