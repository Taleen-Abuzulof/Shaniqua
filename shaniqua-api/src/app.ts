import Fastify, { type FastifyServerOptions } from 'fastify'
import { healthRoutes } from './routes/health.js'

/** Builds the app without listening, so tests can drive it with `inject`. */
export function buildApp(options: FastifyServerOptions = {}) {
  const app = Fastify(options)

  app.register(healthRoutes)

  return app
}
