"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import ConnectStatus from "../../../../components/ConnectStatus";
import {
  completeInstagramConnect,
  connectInstagram,
} from "../../../../lib/api";

/**
 * Instagram's OAuth redirect lands here with `code` and `state` (or `error`)
 * in the query string. The backend verifies `state` against the user's
 * session and exchanges `code`; tokens never reach the browser. On success or
 * cancellation the user goes back to /home; on failure the error shows here.
 */
export default function ConnectInstagramCallback() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const handled = useRef(false);

  useEffect(() => {
    // The code is single-use: guard against the dev-mode double effect.
    if (handled.current) return;
    handled.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const oauthError = params.get("error");

    // Strip the code/state (and Instagram's trailing `#_`) from the address
    // bar and history before doing anything else.
    window.history.replaceState(null, "", window.location.pathname);

    let outcome: Promise<"connected" | "cancelled" | { error: string }>;

    if (oauthError === "access_denied") {
      outcome = Promise.resolve("cancelled");
    } else if (oauthError) {
      outcome = Promise.resolve({
        error:
          params.get("error_description") ??
          "Instagram couldn't complete the connection.",
      });
    } else if (!code || !state) {
      outcome = Promise.resolve({
        error: "This connection link is invalid or incomplete. Please try again.",
      });
    } else {
      outcome = completeInstagramConnect(code, state).then(
        () => "connected" as const,
        (err: unknown) => ({
          error: err instanceof Error ? err.message : "Something went wrong.",
        }),
      );
    }

    outcome.then((result) => {
      if (typeof result === "string") {
        router.replace(`/home?instagram=${result}`);
      } else {
        setError(result.error);
      }
    });
  }, [router]);

  async function handleRetry() {
    setIsRetrying(true);
    try {
      await connectInstagram();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setIsRetrying(false);
    }
  }

  if (!error) {
    return <ConnectStatus title="Connecting your Instagram account…" isWorking />;
  }

  return (
    <ConnectStatus title="Couldn't connect Instagram" message={error} isError>
      <button
        type="button"
        onClick={handleRetry}
        disabled={isRetrying}
        className="flex h-10 items-center justify-center rounded-full bg-foreground px-5 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
      >
        {isRetrying ? "Redirecting…" : "Try again"}
      </button>
      <Link
        href="/home"
        className="text-sm font-medium text-black hover:underline dark:text-zinc-50"
      >
        Back to home
      </Link>
    </ConnectStatus>
  );
}
