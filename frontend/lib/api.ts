const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// The session lives in HttpOnly cookies set by the backend, so this file never
// sees a token: every request just sends cookies along with `credentials`.

type AuthResponse = {
  authenticated: boolean;
};

async function postJson(path: string, body?: unknown) {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error ?? "Something went wrong. Please try again.");
  }

  return data;
}

/**
 * Asks the backend who the session cookies belong to (it refreshes an
 * expired access token on the way). Returns the user, or null if signed out.
 */
export async function getSessionUser() {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/auth/session`, { credentials: "include" });
  } catch {
    return null;
  }

  if (!res.ok) return null;

  const data = await res.json();
  return data.user ?? null;
}

export async function signUp(email: string, password: string) {
  return (await postJson("/auth/signup", { email, password })) as AuthResponse;
}

export async function logIn(email: string, password: string) {
  return (await postJson("/auth/login", { email, password })) as AuthResponse;
}

/** Trades the refresh token from an email-confirmation link for session cookies. */
export async function exchangeRefreshToken(refreshToken: string) {
  return (await postJson("/auth/exchange", {
    refresh_token: refreshToken,
  })) as AuthResponse;
}

export async function signOut() {
  await postJson("/auth/logout").catch(() => null);
}
