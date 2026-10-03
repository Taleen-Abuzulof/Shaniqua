import 'dotenv/config'
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  schema: '../packages/shared/src/db/schema.ts',
  out: './drizzle',
  // `auth` is Supabase's schema (GoTrue-managed); only manage our own tables.
  schemaFilter: ['public'],
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
