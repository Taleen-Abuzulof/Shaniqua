# shaniqua-api

The fast path: receives Meta comment webhooks and sends the automated DM in
under 2 seconds. Runs as a persistent Fastify process (not serverless). See the
repo's `AGENTS.md` for the architecture.

Run from the repo root (npm workspaces):

- `npm run dev -w shaniqua-api`: dev server with reload on http://localhost:4100
- `npm test -w shaniqua-api`: tests
- `npm run build -w @shaniqua/shared && npm run build -w shaniqua-api`, then
  `npm start -w shaniqua-api`: production build and start

`GET /health` is the liveness probe.
