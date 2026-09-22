import { createClient } from '@supabase/supabase-js'

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
}

// Service-role client: bypasses RLS, server-side only. Never expose this key
// or this client to the frontend.
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

/** Verifies a Supabase access token (from the `Authorization: Bearer <jwt>` header) and returns its user. */
export async function getUserFromToken(token: string) {
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) return null
  return data.user
}

/** Creates a new Supabase Auth user with an email/password credential. */
export async function signUpWithPassword(email: string, password: string) {
  return supabase.auth.signUp({ email, password })
}

/** Verifies an email/password credential and returns a session for it. */
export async function signInWithPassword(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password })
}
