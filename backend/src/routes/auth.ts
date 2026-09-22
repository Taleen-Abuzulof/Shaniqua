import { Hono } from 'hono'
import { signInWithPassword, signUpWithPassword } from '../auth.js'

export const authRoutes = new Hono()

authRoutes.post('/signup', async (c) => {
  const body = await c.req.json().catch(() => null)
  const email = body?.email
  const password = body?.password

  if (typeof email !== 'string' || typeof password !== 'string') {
    return c.json({ error: 'email and password are required' }, 400)
  }

  const { data, error } = await signUpWithPassword(email, password)
  if (error) {
    return c.json({ error: error.message }, 400)
  }

  return c.json({ user: data.user, session: data.session })
})

authRoutes.post('/login', async (c) => {
  const body = await c.req.json().catch(() => null)
  const email = body?.email
  const password = body?.password

  if (typeof email !== 'string' || typeof password !== 'string') {
    return c.json({ error: 'email and password are required' }, 400)
  }

  const { data, error } = await signInWithPassword(email, password)
  if (error) {
    return c.json({ error: error.message }, 401)
  }

  return c.json({ user: data.user, session: data.session })
})
