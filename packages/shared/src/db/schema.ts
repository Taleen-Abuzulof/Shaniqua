import { sql } from 'drizzle-orm'
import {
  index,
  integer,
  pgEnum,
  pgSchema,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'

// ---------------------------------------------------------------------------
// Supabase Auth. `auth.users` is owned and managed by Supabase (GoTrue), not
// by our migrations — this is a read-only reference so foreign keys can point
// at it. drizzle.config.ts restricts `db:generate`/`db:migrate` to the
// `public` schema so drizzle-kit never tries to create/alter/drop it.
// ---------------------------------------------------------------------------

const authSchema = pgSchema('auth')

export const authUsers = authSchema.table('users', {
  id: uuid('id').primaryKey(),
})

// ---------------------------------------------------------------------------
// App tables
// ---------------------------------------------------------------------------

export const igAccountStatus = pgEnum('ig_account_status', [
  'active',
  'token_expired', // token expired or revoked; user must reconnect
  'disconnected',
])

export const mediaType = pgEnum('media_type', ['IMAGE', 'VIDEO', 'CAROUSEL_ALBUM'])

// Instagram distinguishes feed posts from reels via media_product_type.
export const mediaProductType = pgEnum('media_product_type', ['FEED', 'REELS', 'STORY', 'AD'])

export const automationStatus = pgEnum('automation_status', ['active', 'paused'])

export const deliveryStatus = pgEnum('delivery_status', ['sent', 'failed'])

/** A connected Instagram professional account. */
export const igAccounts = pgTable(
  'ig_accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    // Instagram-scoped ID. Webhook payloads identify the account by this, so it
    // is globally unique: one IG account can belong to only one app user.
    igUserId: text('ig_user_id').notNull().unique(),
    username: text('username').notNull(),
    name: text('name'),
    profilePictureUrl: text('profile_picture_url'),
    // AES-256-GCM ciphertext (encoded iv + auth tag + data). Never store plaintext.
    accessTokenEncrypted: text('access_token_encrypted').notNull(),
    tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }),
    scopes: text('scopes').array().notNull().default(sql`'{}'::text[]`),
    status: igAccountStatus('status').notNull().default('active'),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index('ig_accounts_user_id_idx').on(t.userId)],
)

/** Synced posts/reels metadata. */
export const media = pgTable(
  'media',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    igAccountId: uuid('ig_account_id')
      .notNull()
      .references(() => igAccounts.id, { onDelete: 'cascade' }),
    // Instagram media ID; comment webhooks reference the post by this.
    igMediaId: text('ig_media_id').notNull().unique(),
    mediaType: mediaType('media_type').notNull(),
    mediaProductType: mediaProductType('media_product_type').notNull(),
    caption: text('caption'),
    permalink: text('permalink').notNull(),
    mediaUrl: text('media_url'),
    thumbnailUrl: text('thumbnail_url'),
    postedAt: timestamp('posted_at', { withTimezone: true }).notNull(),
    likeCount: integer('like_count'),
    commentsCount: integer('comments_count'),
    syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('media_ig_account_posted_at_idx').on(t.igAccountId, t.postedAt)],
)

/**
 * Trigger rule (reel + keywords) and the DM it sends. A comment triggers it
 * when it contains any keyword, compared after `normalizeForMatch` (see
 * keywords.ts). One automation per reel.
 */
export const automations = pgTable(
  'automations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    igAccountId: uuid('ig_account_id')
      .notNull()
      .references(() => igAccounts.id, { onDelete: 'cascade' }),
    mediaId: uuid('media_id')
      .notNull()
      .unique()
      .references(() => media.id, { onDelete: 'cascade' }),
    name: text('name'),
    // As the user typed them; normalized at match time.
    keywords: text('keywords').array().notNull(),
    // Templated text only; nothing in the send path may call out to an LLM.
    messageTemplate: text('message_template').notNull(),
    // One button for the DM; `urls` are sent as links in the same message.
    buttonText: text('button_text').notNull(),
    urls: text('urls').array().notNull(),
    status: automationStatus('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index('automations_ig_account_id_idx').on(t.igAccountId)],
)

/** One row per attempted DM; feeds the performance dashboard. Written after the send. */
export const automationLogs = pgTable(
  'automation_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    automationId: uuid('automation_id')
      .notNull()
      .references(() => automations.id, { onDelete: 'cascade' }),
    igCommentId: text('ig_comment_id').notNull(),
    commenterIgId: text('commenter_ig_id'),
    status: deliveryStatus('status').notNull(),
    // Comment webhook received -> Send API response, in milliseconds.
    latencyMs: integer('latency_ms').notNull(),
    // Meta message id on success; error details on failure.
    igMessageId: text('ig_message_id'),
    errorCode: text('error_code'),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Meta allows one private reply per comment; also makes webhook retries idempotent.
    unique('automation_logs_automation_comment_uniq').on(t.automationId, t.igCommentId),
    index('automation_logs_automation_created_idx').on(t.automationId, t.createdAt),
  ],
)
