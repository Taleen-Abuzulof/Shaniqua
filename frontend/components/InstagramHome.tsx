"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  ApiError,
  createAutomation,
  getInstagramReels,
  listAutomations,
  updateAutomation,
  needsInstagramReconnect,
  syncInstagramReels,
  type Automation,
  type AutomationInput,
  type InstagramReel,
  type InstagramReelsResponse,
} from "../lib/api";
import AutomationDrawer from "./AutomationDrawer";
import ConnectInstagramButton from "./ConnectInstagramButton";
import ReelCard from "./ReelCard";

/** Outcome flag the Instagram callback page appends when it sends the user back. */
export type InstagramConnectResult = "connected" | "cancelled";

type State =
  | { status: "loading" }
  | { status: "not_connected" }
  | { status: "reconnect"; message: string }
  | { status: "error"; message: string }
  | { status: "ready"; data: InstagramReelsResponse };

export default function InstagramHome({
  connectResult,
}: {
  connectResult?: InstagramConnectResult;
}) {
  const router = useRouter();
  // Captured once so the notice survives stripping the flag from the URL.
  const [notice] = useState(connectResult);
  const [state, setState] = useState<State>({ status: "loading" });
  const [isSyncing, setIsSyncing] = useState(false);

  const applyResult = useCallback(
    (load: Promise<InstagramReelsResponse>) =>
      load.then(
        (data) => {
          setState(
            data.account.status === "active"
              ? { status: "ready", data }
              : {
                  status: "reconnect",
                  message: "Your Instagram connection has expired.",
                },
          );
        },
        (err: unknown) => {
          if (err instanceof ApiError && err.status === 404) {
            setState({ status: "not_connected" });
          } else if (needsInstagramReconnect(err)) {
            setState({
              status: "reconnect",
              message: err instanceof Error ? err.message : "",
            });
          } else {
            setState({
              status: "error",
              message:
                err instanceof Error ? err.message : "Something went wrong.",
            });
          }
        },
      ),
    [],
  );

  useEffect(() => {
    // Drop `?instagram=...` so a refresh doesn't repeat the notice.
    if (connectResult) router.replace("/home", { scroll: false });
  }, [connectResult, router]);

  useEffect(() => {
    applyResult(getInstagramReels());
  }, [applyResult]);

  async function handleSync() {
    setIsSyncing(true);
    await applyResult(syncInstagramReels());
    setIsSyncing(false);
  }

  return (
    <div className="mt-6 flex flex-col gap-6">
      {notice === "connected" ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400" role="status">
          Your Instagram account is connected.
        </p>
      ) : null}
      {notice === "cancelled" ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400" role="status">
          Instagram connection was cancelled.
        </p>
      ) : null}

      {state.status === "loading" ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400" role="status">
          Loading your reels…
        </p>
      ) : null}

      {state.status === "not_connected" ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Connect your Instagram professional account to see your reels here.
          </p>
          <ConnectInstagramButton />
        </div>
      ) : null}

      {state.status === "reconnect" ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {state.message} Reconnect to keep syncing your reels.
          </p>
          <ConnectInstagramButton label="Reconnect Instagram" />
        </div>
      ) : null}

      {state.status === "error" ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {state.message}
        </p>
      ) : null}

      {state.status === "ready" ? (
        <ReelsSection
          data={state.data}
          isSyncing={isSyncing}
          onSync={handleSync}
        />
      ) : null}
    </div>
  );
}

function ReelsSection({
  data,
  isSyncing,
  onSync,
}: {
  data: InstagramReelsResponse;
  isSyncing: boolean;
  onSync: () => void;
}) {
  const { account, reels, syncError } = data;
  const [selectedReel, setSelectedReel] = useState<InstagramReel | null>(null);
  const closeDrawer = useCallback(() => setSelectedReel(null), []);
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [automationsError, setAutomationsError] = useState<string | null>(null);

  useEffect(() => {
    listAutomations().then(setAutomations, (err: unknown) => {
      setAutomationsError(
        err instanceof Error ? err.message : "Couldn't load your automations.",
      );
    });
  }, []);

  // One automation per reel, so the reel's id finds it.
  const automationByReel = new Map(automations.map((a) => [a.mediaId, a]));

  async function handleSave(input: AutomationInput) {
    const existing = automationByReel.get(input.mediaId);
    const saved = existing
      ? await updateAutomation(existing.id, {
          keywords: input.keywords,
          message: input.message,
          buttonText: input.buttonText,
          urls: input.urls,
        })
      : await createAutomation(input);
    setAutomations((current) => [saved, ...current.filter((a) => a.id !== saved.id)]);
    setSelectedReel(null);
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {account.profilePictureUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={account.profilePictureUrl}
              alt=""
              referrerPolicy="no-referrer"
              className="h-10 w-10 rounded-full bg-zinc-200 object-cover dark:bg-zinc-800"
            />
          ) : null}
          <div>
            <h2 className="text-base font-semibold tracking-tight text-black dark:text-zinc-50">
              Your reels
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              @{account.username} · {reels.length}{" "}
              {reels.length === 1 ? "reel" : "reels"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onSync}
          disabled={isSyncing}
          className="rounded-full border border-black/[.08] px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-black/[.04] disabled:opacity-50 dark:border-white/[.145] dark:text-zinc-50 dark:hover:bg-[#1a1a1a]"
        >
          {isSyncing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {automationsError ? (
        <p className="text-sm text-amber-700 dark:text-amber-400" role="status">
          {automationsError}
        </p>
      ) : null}

      {syncError ? (
        <p className="text-sm text-amber-700 dark:text-amber-400" role="status">
          {syncError}
        </p>
      ) : null}

      {reels.length === 0 ? (
        <div className="rounded-xl border border-dashed border-black/[.12] px-6 py-12 text-center dark:border-white/[.145]">
          <p className="text-sm font-medium text-black dark:text-zinc-50">
            No reels yet
          </p>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Reels you post on @{account.username} will show up here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {reels.map((reel) => (
            <ReelCard
              key={reel.id}
              reel={reel}
              automationStatus={automationByReel.get(reel.id)?.status}
              onSelect={setSelectedReel}
            />
          ))}
        </div>
      )}

      {selectedReel ? (
        <AutomationDrawer
          key={selectedReel.id}
          reel={selectedReel}
          automation={automationByReel.get(selectedReel.id)}
          onClose={closeDrawer}
          onSave={handleSave}
        />
      ) : null}
    </section>
  );
}
