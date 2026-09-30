// Same-origin by default: next.config.ts proxies `/api/*` to the backend.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "/api";

// The session lives in HttpOnly cookies set by the backend, so this file never
// sees a token: every request just sends cookies along with `credentials`.

type AuthResponse = {
  authenticated: boolean;
};

/** A non-2xx response from the backend; `body` holds any extra error fields. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function requestJson(path: string, init?: RequestInit) {
  const res = await fetch(`${API_URL}${path}`, { ...init, credentials: "include" });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(
      data.error ?? "Something went wrong. Please try again.",
      res.status,
      data,
    );
  }

  return data;
}

async function getJson(path: string) {
  return requestJson(path);
}

async function postJson(path: string, body?: unknown) {
  return requestJson(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
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

// ---------------------------------------------------------------------------
// Instagram connection
//
// The OAuth flow is a full-page redirect:
//   1. `connectInstagram()` asks the backend for the Instagram authorize URL
//      (the backend binds a one-time `state` to the user's session) and sends
//      the whole tab there.
//   2. Instagram redirects back to /connect/instagram/callback, which hands
//      `code` + `state` to the backend to exchange and store server-side
//      (tokens never reach the browser).
//   3. The callback page sends the user to /home with an `instagram=<result>`
//      flag, or shows the error in place.
// ---------------------------------------------------------------------------

export type InstagramAccount = {
  id: string;
  igUserId: string;
  username: string;
  name: string | null;
  profilePictureUrl: string | null;
  // token_expired: the user must reconnect before anything can sync.
  status: "active" | "token_expired" | "disconnected";
  lastSyncedAt: string | null;
};

export type InstagramReel = {
  id: string;
  igMediaId: string;
  caption: string | null;
  permalink: string;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  postedAt: string;
  likeCount: number | null;
  commentsCount: number | null;
};

export type InstagramReelsResponse = {
  account: InstagramAccount;
  reels: InstagramReel[];
  // Set when a background refresh failed and cached reels were returned.
  syncError: string | null;
};

// Only ever send the user to Meta's own OAuth dialogs, even if the backend
// response were tampered with.
const INSTAGRAM_AUTHORIZE_HOSTS = ["www.instagram.com", "www.facebook.com"];

/**
 * Starts connecting the user's Instagram account by redirecting the current
 * tab to Instagram's authorize page. Only returns if it fails (throws).
 */
export async function connectInstagram(): Promise<void> {
  const data = (await postJson("/instagram/connect/start")) as { authorizeUrl?: unknown };

  let url: URL;
  try {
    url = new URL(String(data.authorizeUrl));
  } catch {
    throw new Error("Couldn't start the Instagram connection. Please try again.");
  }

  if (url.protocol !== "https:" || !INSTAGRAM_AUTHORIZE_HOSTS.includes(url.hostname)) {
    throw new Error("Couldn't start the Instagram connection. Please try again.");
  }

  window.location.assign(url.toString());
}

/** Callback page: hands the OAuth `code` + `state` to the backend to finish connecting. */
export async function completeInstagramConnect(code: string, state: string) {
  const data = (await postJson("/instagram/connect/callback", { code, state })) as {
    account: InstagramAccount;
  };
  return data.account;
}

/** The user's connected Instagram account, or null if none is connected. */
export async function getInstagramAccount() {
  const data = (await getJson("/instagram/account")) as {
    account: InstagramAccount | null;
  };
  return data.account;
}

/**
 * The connected account's reels, newest first. The backend re-syncs from
 * Instagram first when its copy is stale. Throws ApiError with
 * `body.reconnect === true` if the Instagram connection has expired.
 */
export async function getInstagramReels() {
  return (await getJson("/instagram/reels")) as InstagramReelsResponse;
}

/** Forces a re-sync of reels from Instagram, then returns them. */
export async function syncInstagramReels() {
  return (await postJson("/instagram/reels/sync")) as InstagramReelsResponse;
}

/** True if an error means the Instagram account has to be reconnected. */
export function needsInstagramReconnect(err: unknown) {
  return err instanceof ApiError && err.body.reconnect === true;
}
