"use client";

import { useEffect, useState } from "react";
import { getSessionUser } from "./api";

export type SessionStatus = "loading" | "authenticated" | "unauthenticated";

/** Verifies the stored access token against the backend on mount. */
export function useSession() {
  const [status, setStatus] = useState<SessionStatus>("loading");

  useEffect(() => {
    let cancelled = false;

    getSessionUser().then((user) => {
      if (cancelled) return;
      setStatus(user ? "authenticated" : "unauthenticated");
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return status;
}
