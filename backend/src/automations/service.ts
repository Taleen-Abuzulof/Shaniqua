import { and, desc, eq, sql } from 'drizzle-orm'
import { automationLogs, automations, media } from '@shaniqua/shared/db/schema'
import { db } from '../db/index.js'
import {
  ensureWebhookSubscription,
  InstagramReconnectRequiredError,
  type IgAccount,
} from '../instagram/service.js'
import {
  parseButtonText,
  parseKeywords,
  parseMessage,
  parseName,
  parseStatus,
  parseUrls,
  parseUuid,
  ValidationError,
} from './validation.js'

export class AutomationNotFoundError extends Error {
  constructor() {
    super('Automation not found.')
    this.name = 'AutomationNotFoundError'
  }
}

export class ReelNotFoundError extends Error {
  constructor() {
    super("That reel isn't on your connected Instagram account. Refresh your reels and try again.")
    this.name = 'ReelNotFoundError'
  }
}

export class ReelAlreadyAutomatedError extends Error {
  constructor() {
    super('This reel already has an automation. Edit it instead.')
    this.name = 'ReelAlreadyAutomatedError'
  }
}

// Per-automation delivery numbers from automation_logs. Latency only counts
// DMs that were actually sent.
const stats = db
  .select({
    automationId: automationLogs.automationId,
    sent: sql<number>`count(*) filter (where ${automationLogs.status} = 'sent')`.mapWith(Number).as('sent'),
    failed: sql<number>`count(*) filter (where ${automationLogs.status} = 'failed')`.mapWith(Number).as('failed'),
    avgLatencyMs: sql<number | null>`round(avg(${automationLogs.latencyMs}) filter (where ${automationLogs.status} = 'sent'))`
      .mapWith((value) => (value === null ? null : Number(value)))
      .as('avg_latency_ms'),
    lastTriggeredAt: sql<Date | null>`max(${automationLogs.createdAt})`
      .mapWith((value) => (value === null ? null : new Date(value)))
      .as('last_triggered_at'),
  })
  .from(automationLogs)
  .groupBy(automationLogs.automationId)
  .as('stats')

function selectAutomations() {
  return db
    .select({
      automation: automations,
      media,
      stats: {
        sent: stats.sent,
        failed: stats.failed,
        avgLatencyMs: stats.avgLatencyMs,
        lastTriggeredAt: stats.lastTriggeredAt,
      },
    })
    .from(automations)
    .innerJoin(media, eq(media.id, automations.mediaId))
    .leftJoin(stats, eq(stats.automationId, automations.id))
}

type AutomationRow = Awaited<ReturnType<ReturnType<typeof selectAutomations>['execute']>>[number]

/** Public shape of an automation, with its reel and delivery stats. */
function toAutomationDto({ automation, media: reel, stats: s }: AutomationRow) {
  const sent = s?.sent ?? 0
  const failed = s?.failed ?? 0
  return {
    id: automation.id,
    mediaId: automation.mediaId,
    name: automation.name,
    keywords: automation.keywords,
    message: automation.messageTemplate,
    buttonText: automation.buttonText,
    urls: automation.urls,
    status: automation.status,
    createdAt: automation.createdAt,
    updatedAt: automation.updatedAt,
    media: {
      id: reel.id,
      igMediaId: reel.igMediaId,
      caption: reel.caption,
      permalink: reel.permalink,
      thumbnailUrl: reel.thumbnailUrl,
      postedAt: reel.postedAt,
    },
    stats: {
      sent,
      failed,
      // Share of attempted DMs that were delivered; null until the first attempt.
      deliveryRate: sent + failed > 0 ? sent / (sent + failed) : null,
      avgLatencyMs: s?.avgLatencyMs ?? null,
      lastTriggeredAt: s?.lastTriggeredAt ?? null,
    },
  }
}

export type AutomationDto = ReturnType<typeof toAutomationDto>

/**
 * Subscribing the account to comment webhooks is idempotent, so it's renewed
 * whenever an automation is saved active. Failures are logged rather than
 * blocking the save (e.g. before the webhook callback is configured in the
 * Meta dashboard), except that `requireValidToken` rethrows an expired token.
 */
async function ensureSubscribed(account: IgAccount, { requireValidToken }: { requireValidToken: boolean }) {
  try {
    await ensureWebhookSubscription(account)
  } catch (err) {
    if (requireValidToken && err instanceof InstagramReconnectRequiredError) throw err
    console.error('Webhook subscription failed:', err)
  }
}

function isUniqueViolation(err: unknown) {
  const code = (err as { code?: string; cause?: { code?: string } })?.code
    ?? (err as { cause?: { code?: string } })?.cause?.code
  return code === '23505'
}

export async function listAutomations(account: IgAccount) {
  const rows = await selectAutomations()
    .where(eq(automations.igAccountId, account.id))
    .orderBy(desc(automations.createdAt))
  return rows.map(toAutomationDto)
}

async function getAutomation(account: IgAccount, id: string) {
  const [row] = await selectAutomations().where(
    and(eq(automations.id, id), eq(automations.igAccountId, account.id)),
  )
  if (!row) throw new AutomationNotFoundError()
  return toAutomationDto(row)
}

export async function createAutomation(account: IgAccount, body: Record<string, unknown>) {
  const values = {
    mediaId: parseUuid(body.mediaId, 'mediaId'),
    name: parseName(body.name),
    keywords: parseKeywords(body.keywords),
    messageTemplate: parseMessage(body.message),
    buttonText: parseButtonText(body.buttonText),
    urls: parseUrls(body.urls),
  }

  const [reel] = await db
    .select({ id: media.id })
    .from(media)
    .where(and(eq(media.id, values.mediaId), eq(media.igAccountId, account.id)))
  if (!reel) throw new ReelNotFoundError()

  // A new automation is useless without a working token, so ask to reconnect first.
  await ensureSubscribed(account, { requireValidToken: true })

  let id: string
  try {
    const [created] = await db
      .insert(automations)
      .values({ ...values, igAccountId: account.id })
      .returning({ id: automations.id })
    id = created.id
  } catch (err) {
    if (isUniqueViolation(err)) throw new ReelAlreadyAutomatedError()
    throw err
  }

  return getAutomation(account, id)
}

/** Partial update: only the fields present in `body` change. */
export async function updateAutomation(account: IgAccount, id: string, body: Record<string, unknown>) {
  parseUuid(id, 'id')
  const changes: Partial<typeof automations.$inferInsert> = {}
  if ('name' in body) changes.name = parseName(body.name)
  if ('keywords' in body) changes.keywords = parseKeywords(body.keywords)
  if ('message' in body) changes.messageTemplate = parseMessage(body.message)
  if ('buttonText' in body) changes.buttonText = parseButtonText(body.buttonText)
  if ('urls' in body) changes.urls = parseUrls(body.urls)
  if ('status' in body) changes.status = parseStatus(body.status)
  if (Object.keys(changes).length === 0) throw new ValidationError('Nothing to update.')

  const [updated] = await db
    .update(automations)
    .set(changes)
    .where(and(eq(automations.id, id), eq(automations.igAccountId, account.id)))
    .returning({ status: automations.status })
  if (!updated) throw new AutomationNotFoundError()

  // The change is saved either way; the home page prompts to reconnect if needed.
  if (updated.status === 'active') await ensureSubscribed(account, { requireValidToken: false })

  return getAutomation(account, id)
}

export async function deleteAutomation(account: IgAccount, id: string) {
  parseUuid(id, 'id')
  const [deleted] = await db
    .delete(automations)
    .where(and(eq(automations.id, id), eq(automations.igAccountId, account.id)))
    .returning({ id: automations.id })
  if (!deleted) throw new AutomationNotFoundError()
}
