"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  deleteAutomation,
  listAutomations,
  updateAutomation,
  type Automation,
  type AutomationInput,
} from "../lib/api";
import AutomationDrawer from "./AutomationDrawer";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; automations: Automation[] };

const percentFormat = new Intl.NumberFormat(undefined, {
  style: "percent",
  maximumFractionDigits: 1,
});

export default function AutomationsDashboard() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [editing, setEditing] = useState<Automation | null>(null);
  const closeDrawer = useCallback(() => setEditing(null), []);

  useEffect(() => {
    listAutomations().then(
      (automations) => setState({ status: "ready", automations }),
      (err: unknown) =>
        setState({
          status: "error",
          message: err instanceof Error ? err.message : "Couldn't load your automations.",
        }),
    );
  }, []);

  function replace(saved: Automation) {
    setState((current) =>
      current.status === "ready"
        ? {
            status: "ready",
            automations: current.automations.map((a) => (a.id === saved.id ? saved : a)),
          }
        : current,
    );
  }

  function remove(id: string) {
    setState((current) =>
      current.status === "ready"
        ? { status: "ready", automations: current.automations.filter((a) => a.id !== id) }
        : current,
    );
  }

  async function handleSave(input: AutomationInput) {
    if (!editing) return;
    replace(
      await updateAutomation(editing.id, {
        keywords: input.keywords,
        message: input.message,
        buttonText: input.buttonText,
        urls: input.urls,
      }),
    );
    setEditing(null);
  }

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-6 py-12 sm:px-10">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
              Automations
            </h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Manage the automated DMs triggered by comments on your reels.
            </p>
          </div>
          <AddAutomationLink className="shrink-0" />
        </div>

        <div className="mt-8">
          {state.status === "loading" ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400" role="status">
              Loading your automations…
            </p>
          ) : null}

          {state.status === "error" ? (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {state.message}
            </p>
          ) : null}

          {state.status === "ready" && state.automations.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-black/[.08] px-6 py-20 text-center dark:border-white/[.145]">
              <p className="text-base font-medium text-black dark:text-zinc-50">
                No automations yet
              </p>
              <p className="mt-1 max-w-sm text-sm text-zinc-600 dark:text-zinc-400">
                Pick a reel on the home page to start sending automatic DMs when
                people comment on it.
              </p>
              <AddAutomationLink className="mt-6" />
            </div>
          ) : null}

          {state.status === "ready" && state.automations.length > 0 ? (
            <ul className="flex flex-col gap-3">
              {state.automations.map((automation) => (
                <AutomationCard
                  key={automation.id}
                  automation={automation}
                  onEdit={() => setEditing(automation)}
                  onUpdated={replace}
                  onDeleted={() => remove(automation.id)}
                />
              ))}
            </ul>
          ) : null}
        </div>
      </main>

      {editing ? (
        <AutomationDrawer
          key={editing.id}
          reel={editing.media}
          automation={editing}
          onClose={closeDrawer}
          onSave={handleSave}
        />
      ) : null}
    </div>
  );
}

function AddAutomationLink({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/home"
      className={`flex h-10 items-center justify-center rounded-full bg-foreground px-5 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc] ${className}`}
    >
      Add automation
    </Link>
  );
}

function AutomationCard({
  automation,
  onEdit,
  onUpdated,
  onDeleted,
}: {
  automation: Automation;
  onEdit: () => void;
  onUpdated: (automation: Automation) => void;
  onDeleted: () => void;
}) {
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const { media, stats } = automation;
  const isActive = automation.status === "active";

  async function run(action: () => Promise<void>) {
    setIsBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsBusy(false);
    }
  }

  function toggleStatus() {
    return run(async () => {
      onUpdated(
        await updateAutomation(automation.id, { status: isActive ? "paused" : "active" }),
      );
    });
  }

  function handleDelete() {
    if (!window.confirm("Delete this automation? Its delivery history is deleted too.")) return;
    return run(async () => {
      await deleteAutomation(automation.id);
      onDeleted();
    });
  }

  const secondaryButton =
    "rounded-full border border-black/[.08] px-3 py-1.5 text-xs font-medium text-black transition-colors hover:bg-black/[.04] disabled:opacity-50 dark:border-white/[.145] dark:text-zinc-50 dark:hover:bg-[#1a1a1a]";

  return (
    <li className="rounded-2xl border border-black/[.08] bg-white px-5 py-4 dark:border-white/[.145] dark:bg-[#0a0a0a]">
      <div className="flex items-start gap-4">
        <a
          href={media.permalink}
          target="_blank"
          rel="noopener noreferrer"
          className="relative aspect-[9/16] w-12 shrink-0 overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-900"
          aria-label="View reel on Instagram"
        >
          {media.thumbnailUrl && !imageFailed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={media.thumbnailUrl}
              alt=""
              referrerPolicy="no-referrer"
              onError={() => setImageFailed(true)}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : null}
        </a>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-start justify-between gap-3">
            <p dir="auto" className="line-clamp-2 text-sm font-medium text-black dark:text-zinc-50">
              {automation.name || media.caption || (
                <span className="text-zinc-500 dark:text-zinc-400">Reel without a caption</span>
              )}
            </p>
            <StatusBadge isActive={isActive} />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {automation.keywords.map((keyword) => (
              <span
                key={keyword}
                className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-black dark:bg-zinc-800 dark:text-zinc-50"
              >
                <bdi>{keyword}</bdi>
              </span>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={onEdit} disabled={isBusy} className={secondaryButton}>
              Edit
            </button>
            <button type="button" onClick={toggleStatus} disabled={isBusy} className={secondaryButton}>
              {isActive ? "Pause" : "Resume"}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isBusy}
              className="rounded-full px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-500/10"
            >
              Delete
            </button>
          </div>

          {error ? (
            <p className="text-xs text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4 border-t border-black/[.06] pt-3 dark:border-white/[.08]">
        <Stat
          label="Delivery rate"
          value={stats.deliveryRate === null ? "—" : percentFormat.format(stats.deliveryRate)}
        />
        <Stat
          label="Avg. latency"
          value={stats.avgLatencyMs === null ? "—" : `${stats.avgLatencyMs.toLocaleString()}ms`}
        />
        <Stat label="DMs sent" value={stats.sent.toLocaleString()} />
      </div>
    </li>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-zinc-500 dark:text-zinc-500">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-black dark:text-zinc-50">{value}</p>
    </div>
  );
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        isActive
          ? "bg-green-100 text-green-800 dark:bg-green-500/10 dark:text-green-400"
          : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-green-500" : "bg-zinc-400"}`} />
      {isActive ? "Active" : "Paused"}
    </span>
  );
}
