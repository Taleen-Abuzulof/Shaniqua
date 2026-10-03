import type { FastifyPluginAsync } from 'fastify'

/** Liveness probe for the container platform; keep it free of I/O. */
export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/health', async () => ({ ok: true }))
}
