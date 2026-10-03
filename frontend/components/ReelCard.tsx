"use client";

import { useState } from "react";
import type { AutomationStatus, InstagramReel } from "../lib/api";

const dateFormat = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export default function ReelCard({
  reel,
  automationStatus,
  onSelect,
}: {
  reel: InstagramReel;
  // Set when the reel has an automation.
  automationStatus?: AutomationStatus;
  onSelect: (reel: InstagramReel) => void;
}) {
  // Instagram CDN URLs are signed and expire; fall back to a placeholder.
  const [imageFailed, setImageFailed] = useState(false);
  const imageUrl = reel.thumbnailUrl;

  return (
    <button
      type="button"
      onClick={() => onSelect(reel)}
      className="group flex flex-col text-left overflow-hidden rounded-xl border border-black/[.08] bg-white transition-colors hover:border-black/20 dark:border-white/[.145] dark:bg-[#0a0a0a] dark:hover:border-white/30"
    >
      <div className="relative aspect-[9/16] w-full bg-zinc-100 dark:bg-zinc-900">
        {imageUrl && !imageFailed ? (
          // Remote, short-lived Instagram CDN URL: next/image optimization
          // would cache it past expiry, so use a plain img.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={reel.caption ?? "Instagram reel"}
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setImageFailed(true)}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-xs text-zinc-500 dark:text-zinc-400">
            Preview unavailable
          </span>
        )}
        {automationStatus ? (
          <span
            className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-xs font-medium backdrop-blur ${
              automationStatus === "active"
                ? "bg-emerald-500/90 text-white"
                : "bg-black/60 text-white"
            }`}
          >
            {automationStatus === "active" ? "Automation on" : "Automation paused"}
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <p dir="auto" className="line-clamp-2 text-sm text-black dark:text-zinc-50">
          {reel.caption || (
            <span className="text-zinc-500 dark:text-zinc-400">No caption</span>
          )}
        </p>
        <div className="mt-auto flex items-center justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <span>{dateFormat.format(new Date(reel.postedAt))}</span>
          <span className="flex items-center gap-3">
            {reel.likeCount !== null ? (
              <span>{reel.likeCount.toLocaleString()} likes</span>
            ) : null}
            {reel.commentsCount !== null ? (
              <span>{reel.commentsCount.toLocaleString()} comments</span>
            ) : null}
          </span>
        </div>
      </div>
    </button>
  );
}
