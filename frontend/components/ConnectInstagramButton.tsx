"use client";

import { useState } from "react";
import { connectInstagram } from "../lib/api";

/** Starts the Instagram OAuth redirect; shows an error if it can't start. */
export default function ConnectInstagramButton({
  label = "Connect Instagram",
}: {
  label?: string;
}) {
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConnect() {
    setError(null);
    setIsRedirecting(true);
    try {
      // Navigates away on success; only returns here if starting failed.
      await connectInstagram();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setIsRedirecting(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleConnect}
        disabled={isRedirecting}
        className="w-fit rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-black dark:hover:bg-zinc-200"
      >
        {isRedirecting ? "Redirecting to Instagram…" : label}
      </button>
      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
