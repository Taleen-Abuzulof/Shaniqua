# Instagram DM Automation Web App: Shaniqua

## Overview
A web app that lets a user connect their Instagram professional account, view their posts/reels, and create automations that send a private DM to someone when they leave a specific comment on a post or reel. The user can view all their automations and their performance.

**Critical non-functional requirement:** when someone comments, the automated DM must be sent in **under 2 seconds**.

## User stories
1. As a user, I can connect my Instagram account and sync my Instagram data safely.
2. As a user, I can see my posts and reels inside the web app.
3. As a user, I can create an automation: a trigger (a specific comment/keyword on a chosen post or reel) that sends an automated DM.
4. As a user, I can view all my current automations and their performance (delivery success, latency, volume).

## Architecture: two latency profiles

The app splits into two services with very different performance requirements — this split is the central architectural decision.

**Slow path (main app)** — account connection, data sync, dashboard, automation CRUD. Normal web latency is fine.

**Fast path (automation pipeline)** — must consistently land under 2s, end to end:
1. Comment posted on a post/reel
2. Meta webhook fires → webhook receiver acks Meta and enqueues the event
3. Event goes onto a Redis queue
4. Worker picks it up, matches the automation rule (cached in Redis, no DB round-trip), and calls Meta's Send API
5. DM delivered as a private reply
6. Delivery result logged to Postgres **asynchronously**, after the reply is sent, to power the performance dashboard

The fast-path receiver/worker must run on an always-warm, persistent process — not serverless — since a cold start alone can consume a large share of the 2s budget.

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | Next.js (TypeScript), Tailwind + shadcn/ui, Recharts for performance charts |
| Main API (slow path) | Node.js/TypeScript (Fastify or Next.js API routes) |
| Fast-path service | Node.js/Fastify on a persistent container (Railway / Fly.io / Render / AWS Fargate) — no serverless |
| Queue + rule cache | Redis (BullMQ) |
| Database | PostgreSQL + Drizzle ORM |
| App auth | better-auth |
| Instagram auth | Meta OAuth — Instagram API with Instagram Login, or Instagram API with Facebook Login |
| DM sending | Meta Private Replies API (`POST /<IG_ID>/messages`, recipient = comment_id) |

## Key Meta API constraints
- Private reply must be sent within **7 days** of the comment (Live: only during the broadcast).
- **One** automated private reply per comment — not an open-ended conversation. Continued messaging only if the person replies.
- Meta requires the webhook to be acknowledged within 5 seconds; the app's own 2-second target for the actual DM send is stricter than that and self-imposed.
- Permissions needed: `instagram_manage_comments`, `instagram_manage_messages`/`pages_messaging`, Human Agent feature, Advanced Access.

## Performance-critical rules
- No LLM or other synchronous call in the critical path — use templated/rule-based messages for the automated reply; any AI personalization happens asynchronously, never blocking the send.
- Automation rules are cached in Redis; the worker never queries Postgres before sending.
- All logging/analytics writes happen after the DM is sent, not before.

## Initial data model
- `ig_accounts` — connected account, encrypted OAuth tokens
- `media` — synced posts/reels metadata
- `automations` — trigger rules (post/reel + keyword) and DM templates
- `automation_logs` — comment id, latency_ms, delivery status (feeds the performance dashboard)

## Status
Tech stack decided. Frontend scaffolded (Next.js + Tailwind, `frontend/`), no backend code yet.

**Frontend so far:**
- Sidebar layout (`app/components/Sidebar.tsx`, wired into `app/layout.tsx`) with two nav links: Home (`/`) and Automations (`/automations`).
- `/` — Home page, placeholder only, not built yet.
- `/automations` — automations dashboard: lists current automations (mock data for now, no API) as cards showing trigger keyword, target post/reel, active/paused status, and delivery rate / avg latency / DM volume; includes an empty state. Has an "Add automation" button.
- `/automations/new` — placeholder route the "Add automation" button links to; form not built yet.
- No shadcn/ui or Recharts installed yet despite being the planned choice — current UI is hand-rolled Tailwind matching the create-next-app starter style (zinc palette, dark mode via `prefers-color-scheme`).