import { createClient } from '@supabase/supabase-js'

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
}

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:3000'

function createServiceClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// Service-role client: bypasses RLS, server-side only. Never expose this key
// or this client to the frontend. Never call a session-producing method
// (sign in/up, refresh) on it: supabase-js keeps that session in memory and
// would then act as that user for every later request.
export const supabase = createServiceClient()

/** Verifies a Supabase access token and returns its user. */
export async function getUserFromToken(token: string) {
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) return null
  return data.user
}

/** Creates a new Supabase Auth user with an email/password credential. */
export async function signUpWithPassword(email: string, password: string) {
  return createServiceClient().auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${FRONTEND_URL}/home` },
  })
}

/** Verifies an email/password credential and returns a session for it. */
export async function signInWithPassword(email: string, password: string) {
  return createServiceClient().auth.signInWithPassword({ email, password })
}

/** Exchanges a refresh token for a new session (Supabase rotates the refresh token). */
export async function refreshSession(refreshToken: string) {
  return createServiceClient().auth.refreshSession({ refresh_token: refreshToken })
}

/** Revokes the session the given access token belongs to (this device only). */
export async function revokeSession(accessToken: string) {
  return supabase.auth.admin.signOut(accessToken, 'local')
}
