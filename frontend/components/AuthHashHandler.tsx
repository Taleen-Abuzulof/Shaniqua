"use client";

import { useEffect, useState } from "react";
import { exchangeRefreshToken } from "../lib/api";

/**
 * Supabase's email confirmation link redirects here with the session in the
 * URL fragment (`#access_token=...&refresh_token=...`), since the redirect
 * target isn't a supabase-js client that would consume it automatically.
 * Strip the fragment immediately so it never lingers in the address bar or
 * history, hand the refresh token to the backend to turn into HttpOnly
 * session cookies, and only then render children (e.g. RequireAuth), so the
 * session check sees the new cookies.
 */
export default function AuthHashHandler({
  children,
}: {
  children: React.ReactNode;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    const refreshToken =
      hash.length > 1
        ? new URLSearchParams(hash.slice(1)).get("refresh_token")
        : null;

    if (hash) {
      // Clear the fragment first, regardless of outcome, so tokens/errors
      // never sit visible in the URL.
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      );
    }

    const exchange = refreshToken
      ? exchangeRefreshToken(refreshToken).catch(() => null)
      : Promise.resolve();

    exchange.finally(() => setReady(true));
  }, []);

  if (!ready) return null;

  return <>{children}</>;
}
