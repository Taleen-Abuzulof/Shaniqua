import 'dotenv/config'
import { buildApp } from './app.js'

// Runs as a persistent, always-warm process (never serverless): a cold start
// would eat most of the 2s comment-to-DM budget.

const port = Number(process.env.PORT) || 4100
const host = process.env.HOST ?? '0.0.0.0'

const app = buildApp({
  logger: { level: process.env.LOG_LEVEL ?? 'info' },
})

async function shutdown(signal: string) {
  app.log.info({ signal }, 'Shutting down')
  try {
    await app.close()
    process.exit(0)
  } catch (err) {
    app.log.error(err, 'Error during shutdown')
    process.exit(1)
  }
}

process.once('SIGINT', () => void shutdown('SIGINT'))
process.once('SIGTERM', () => void shutdown('SIGTERM'))

try {
  await app.listen({ port, host })
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
