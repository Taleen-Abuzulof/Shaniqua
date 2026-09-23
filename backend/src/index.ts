import 'dotenv/config'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { csrf } from 'hono/csrf'
import { authRoutes } from './routes/auth.js'

const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:3000'

const app = new Hono()

app.use(
  '*',
  cors({
    origin: FRONTEND_URL,
    credentials: true,
    allowHeaders: ['Content-Type'],
  }),
)

// Auth is cookie-based, so reject form-style cross-site POSTs (login CSRF etc.)
// whose Origin isn't the frontend.
app.use('*', csrf({ origin: FRONTEND_URL }))

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

app.route('/auth', authRoutes)

const port = Number(process.env.PORT) || 4000

serve({
  fetch: app.fetch,
  port,
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
