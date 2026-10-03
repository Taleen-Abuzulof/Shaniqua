import { Hono, type Context } from 'hono'
import {
  AutomationNotFoundError,
  createAutomation,
  deleteAutomation,
  listAutomations,
  ReelAlreadyAutomatedError,
  ReelNotFoundError,
  updateAutomation,
} from '../automations/service.js'
import { ValidationError } from '../automations/validation.js'
import { getCurrentAccount, InstagramReconnectRequiredError } from '../instagram/service.js'
import { requireAuth, type AuthEnv } from '../session.js'

export const automationRoutes = new Hono<AuthEnv>()

automationRoutes.use('*', requireAuth)

/** Maps service errors to responses; anything unexpected is logged and hidden. */
function handleError(c: Context, err: unknown, fallback: string) {
  if (err instanceof ValidationError) return c.json({ error: err.message }, 400)
  if (err instanceof AutomationNotFoundError || err instanceof ReelNotFoundError) {
    return c.json({ error: err.message }, 404)
  }
  if (err instanceof ReelAlreadyAutomatedError) return c.json({ error: err.message }, 409)
  if (err instanceof InstagramReconnectRequiredError) {
    return c.json({ error: err.message, reconnect: true }, 409)
  }
  console.error(err)
  return c.json({ error: fallback }, 500)
}

async function readBody(c: Context) {
  const body = await c.req.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ValidationError('Expected a JSON object.')
  }
  return body as Record<string, unknown>
}

/** The user's connected account, or a 404 response if there isn't one. */
async function requireAccount(c: Context<AuthEnv>) {
  const account = await getCurrentAccount(c.get('user').id)
  return account ?? c.json({ error: 'No Instagram account is connected.' }, 404)
}

automationRoutes.get('/', async (c) => {
  try {
    const account = await getCurrentAccount(c.get('user').id)
    return c.json({ automations: account ? await listAutomations(account) : [] })
  } catch (err) {
    return handleError(c, err, "Couldn't load your automations.")
  }
})

automationRoutes.post('/', async (c) => {
  try {
    const account = await requireAccount(c)
    if (account instanceof Response) return account
    const automation = await createAutomation(account, await readBody(c))
    return c.json({ automation }, 201)
  } catch (err) {
    return handleError(c, err, "Couldn't create the automation. Please try again.")
  }
})

automationRoutes.patch('/:id', async (c) => {
  try {
    const account = await requireAccount(c)
    if (account instanceof Response) return account
    const automation = await updateAutomation(account, c.req.param('id'), await readBody(c))
    return c.json({ automation })
  } catch (err) {
    return handleError(c, err, "Couldn't update the automation. Please try again.")
  }
})

automationRoutes.delete('/:id', async (c) => {
  try {
    const account = await requireAccount(c)
    if (account instanceof Response) return account
    await deleteAutomation(account, c.req.param('id'))
    return c.body(null, 204)
  } catch (err) {
    return handleError(c, err, "Couldn't delete the automation. Please try again.")
  }
})
