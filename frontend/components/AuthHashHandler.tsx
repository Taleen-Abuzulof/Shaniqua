"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { storeAccessToken } from "../lib/api";

/**
 * Supabase's email confirmation link redirects here with the session in the
 * URL fragment (`#access_token=...&refresh_token=...`), since the redirect
 * target isn't a supabase-js client that would consume it automatically.
 * Pull the token out and strip the fragment immediately so it never lingers
 * in the address bar or browser history.
 */
export default function AuthHashHandler() {
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash || hash.length < 2) return;

    const params = new URLSearchParams(hash.slice(1));
    const accessToken = params.get("access_token");

    // Clear the fragment first, regardless of outcome, so tokens/errors
    // never sit visible in the URL.
    window.history.replaceState(
      null,
      "",
      window.location.pathname + window.location.search,
    );

    if (accessToken) {
      storeAccessToken(accessToken);
      router.refresh();
    }
  }, [router]);

  return null;
}
