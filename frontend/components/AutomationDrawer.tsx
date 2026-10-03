"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Automation, AutomationInput, InstagramReel } from "../lib/api";

// Instagram's limits: message text is capped at 1000 characters and button
// titles at 20.
const MESSAGE_MAX = 1000;
const BUTTON_TEXT_MAX = 20;
const KEYWORD_MAX = 50;
// Typing a comma (Latin or Arabic) or pressing Enter turns the text into a keyword.
const KEYWORD_SEPARATORS = /[,،]/;
const DEFAULT_BUTTON_TEXT = "Show me more";

/** The reel fields the panel shows; satisfied by a reel or an automation's `media`. */
export type DrawerReel = Pick<InstagramReel, "id" | "caption" | "thumbnailUrl" | "permalink">;

type Errors = Partial<Record<"keywords" | "message" | "buttonText" | "urls", string>>;

/** Counts characters the way people see them, so Arabic and emoji count once. */
function charCount(value: string) {
  return [...value].length;
}

/** Comparison key so "Guide" and "guide" count as the same keyword. */
function keywordKey(value: string) {
  return value.normalize("NFC").toLocaleLowerCase();
}

/** Adds the non-empty, not-yet-present keywords in `candidates` to `keywords`. */
function addKeywords(keywords: string[], candidates: string[]) {
  const seen = new Set(keywords.map(keywordKey));
  const next = [...keywords];
  for (const candidate of candidates) {
    const keyword = candidate.trim().replace(/\s+/g, " ");
    if (!keyword || seen.has(keywordKey(keyword))) continue;
    seen.add(keywordKey(keyword));
    next.push(keyword);
  }
  return next;
}

function parseUrls(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function isValidUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function validate(
  keywords: string[],
  message: string,
  buttonText: string,
  urls: string[],
): Errors {
  const errors: Errors = {};

  const tooLong = keywords.find((keyword) => charCount(keyword) > KEYWORD_MAX);
  if (keywords.length === 0) {
    errors.keywords = "Add at least one trigger word.";
  } else if (tooLong) {
    errors.keywords = `Keep each trigger under ${KEYWORD_MAX} characters: ${tooLong}`;
  }

  if (!message.trim()) {
    errors.message = "Write the message people will receive.";
  } else if (charCount(message) > MESSAGE_MAX) {
    errors.message = `Keep the message under ${MESSAGE_MAX} characters.`;
  }

  if (!buttonText.trim()) {
    errors.buttonText = "Give the button a label.";
  } else if (charCount(buttonText) > BUTTON_TEXT_MAX) {
    errors.buttonText = `Keep the button text under ${BUTTON_TEXT_MAX} characters.`;
  }

  const invalid = urls.filter((url) => !isValidUrl(url));
  if (urls.length === 0) {
    errors.urls = "Add at least one link.";
  } else if (invalid.length > 0) {
    errors.urls = `Not a valid link: ${invalid[0]} (links must start with https://).`;
  }

  return errors;
}

/**
 * Right-hand side panel for setting up the DM a reel's automation sends, or
 * editing it when the reel already has one (`automation`). Mount it with
 * `key={reel.id}` so switching reels starts a fresh form. `onSave` creates or
 * updates; if it throws, the error shows in the panel.
 */
export default function AutomationDrawer({
  reel,
  automation,
  onClose,
  onSave,
}: {
  reel: DrawerReel;
  automation?: Automation;
  onClose: () => void;
  onSave: (input: AutomationInput) => Promise<void>;
}) {
  const isEditing = Boolean(automation);
  const titleId = useId();
  const keywordsId = useId();
  const messageId = useId();
  const buttonTextId = useId();
  const urlsId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const keywordInputRef = useRef<HTMLInputElement>(null);

  const [keywords, setKeywords] = useState<string[]>(automation?.keywords ?? []);
  const [keywordInput, setKeywordInput] = useState("");
  const [message, setMessage] = useState(automation?.message ?? "");
  const [buttonText, setButtonText] = useState(automation?.buttonText ?? DEFAULT_BUTTON_TEXT);
  const [urlsText, setUrlsText] = useState(automation?.urls.join("\n") ?? "");
  const [errors, setErrors] = useState<Errors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  const urls = parseUrls(urlsText);

  // Close on Escape, keep Tab inside the panel, and lock the page behind it.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    keywordInputRef.current?.focus();

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;

      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, [tabindex]:not([tabindex="-1"])',
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus();
    };
  }, [onClose]);

  function handleKeywordChange(value: string) {
    // Pasting "guide, link، free" adds the complete parts and keeps the rest.
    if (!KEYWORD_SEPARATORS.test(value)) {
      setKeywordInput(value);
      return;
    }
    const parts = value.split(KEYWORD_SEPARATORS);
    const rest = parts.pop() ?? "";
    setKeywords((current) => addKeywords(current, parts));
    setKeywordInput(rest.trimStart());
  }

  function commitKeywordInput() {
    if (!keywordInput.trim()) return;
    setKeywords((current) => addKeywords(current, [keywordInput]));
    setKeywordInput("");
  }

  function handleKeywordKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    // Ignore Enter while an IME (e.g. some Arabic keyboards) is composing.
    if (event.key === "Enter" && !event.nativeEvent.isComposing) {
      event.preventDefault();
      commitKeywordInput();
    } else if (event.key === "Backspace" && keywordInput === "" && keywords.length > 0) {
      setKeywords((current) => current.slice(0, -1));
    }
  }

  function removeKeyword(keyword: string) {
    setKeywords((current) => current.filter((k) => k !== keyword));
    keywordInputRef.current?.focus();
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (isSaving) return;
    // Count a word that was typed but not yet added with Enter.
    const finalKeywords = addKeywords(keywords, [keywordInput]);
    setKeywords(finalKeywords);
    setKeywordInput("");

    const nextErrors = validate(finalKeywords, message, buttonText, urls);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaveError(null);
    setIsSaving(true);
    try {
      await onSave({
        mediaId: reel.id,
        keywords: finalKeywords,
        message: message.trim(),
        buttonText: buttonText.trim(),
        urls,
      });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Something went wrong.");
      setIsSaving(false);
    }
  }

  const fieldClass =
    "w-full rounded-lg border bg-white px-3 py-2 text-sm text-black outline-none transition-colors placeholder:text-zinc-400 focus:border-black dark:bg-[#0a0a0a] dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-white";
  const borderClass = (hasError: boolean) =>
    hasError
      ? "border-red-500 dark:border-red-400"
      : "border-black/[.12] dark:border-white/[.145]";

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 bg-black/40 animate-fade-in motion-reduce:animate-none"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex h-full w-full max-w-md flex-col border-l border-black/[.08] bg-background shadow-xl animate-slide-in-right motion-reduce:animate-none dark:border-white/[.145]"
      >
        <header className="flex items-start justify-between gap-4 border-b border-black/[.08] px-6 py-4 dark:border-white/[.145]">
          <div>
            <h2
              id={titleId}
              className="text-base font-semibold tracking-tight text-black dark:text-zinc-50"
            >
              {isEditing ? "Edit automation" : "New automation"}
            </h2>
            <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">
              Send a DM when someone comments on this reel.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 rounded-full p-2 text-zinc-500 transition-colors hover:bg-black/[.04] hover:text-black dark:text-zinc-400 dark:hover:bg-[#1a1a1a] dark:hover:text-zinc-50"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden="true">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </header>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-6 py-5">
            <div className="flex gap-3">
              <div className="relative aspect-[9/16] w-16 shrink-0 overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-900">
                {reel.thumbnailUrl && !imageFailed ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={reel.thumbnailUrl}
                    alt=""
                    referrerPolicy="no-referrer"
                    onError={() => setImageFailed(true)}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : null}
              </div>
              <div className="flex min-w-0 flex-col gap-1">
                <p
                  dir="auto"
                  className="line-clamp-3 text-sm text-black dark:text-zinc-50"
                >
                  {reel.caption || (
                    <span className="text-zinc-500 dark:text-zinc-400">No caption</span>
                  )}
                </p>
                <a
                  href={reel.permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-zinc-600 hover:underline dark:text-zinc-400"
                >
                  View on Instagram
                </a>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor={keywordsId}
                className="text-sm font-medium text-black dark:text-zinc-50"
              >
                Trigger words
              </label>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                A comment containing any of these sends the DM. Press Enter or
                type a comma after each word or phrase.
              </p>
              <div
                onClick={() => keywordInputRef.current?.focus()}
                className={`flex min-h-10 cursor-text flex-wrap items-center gap-1.5 rounded-lg border bg-white px-2 py-1.5 transition-colors focus-within:border-black dark:bg-[#0a0a0a] dark:focus-within:border-white ${borderClass(Boolean(errors.keywords))}`}
              >
                {keywords.map((keyword) => (
                  <span
                    key={keyword}
                    className="flex items-center gap-1 rounded-full bg-zinc-100 py-0.5 ps-2.5 pe-1 text-sm text-black dark:bg-zinc-800 dark:text-zinc-50"
                  >
                    <bdi>{keyword}</bdi>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeKeyword(keyword);
                      }}
                      aria-label={`Remove ${keyword}`}
                      className="rounded-full p-0.5 text-zinc-500 transition-colors hover:bg-black/[.06] hover:text-black dark:text-zinc-400 dark:hover:bg-white/[.1] dark:hover:text-zinc-50"
                    >
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
                        <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                      </svg>
                    </button>
                  </span>
                ))}
                <input
                  ref={keywordInputRef}
                  id={keywordsId}
                  type="text"
                  dir="auto"
                  value={keywordInput}
                  onChange={(e) => handleKeywordChange(e.target.value)}
                  onKeyDown={handleKeywordKeyDown}
                  onBlur={commitKeywordInput}
                  placeholder={keywords.length === 0 ? "e.g. guide, رابط" : ""}
                  enterKeyHint="enter"
                  aria-invalid={Boolean(errors.keywords)}
                  aria-describedby={errors.keywords ? `${keywordsId}-error` : undefined}
                  className="min-w-24 flex-1 bg-transparent px-1 py-0.5 text-sm text-black outline-none placeholder:text-zinc-400 dark:text-zinc-50 dark:placeholder:text-zinc-500"
                />
              </div>
              <FieldError id={`${keywordsId}-error`} message={errors.keywords} />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <label
                  htmlFor={messageId}
                  className="text-sm font-medium text-black dark:text-zinc-50"
                >
                  DM message
                </label>
                <CharCounter value={message} max={MESSAGE_MAX} />
              </div>
              <textarea
                id={messageId}
                dir="auto"
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Thanks for your comment! Here's the link you asked for…"
                aria-invalid={Boolean(errors.message)}
                aria-describedby={errors.message ? `${messageId}-error` : undefined}
                className={`${fieldClass} ${borderClass(Boolean(errors.message))} resize-y`}
              />
              <FieldError id={`${messageId}-error`} message={errors.message} />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <label
                  htmlFor={buttonTextId}
                  className="text-sm font-medium text-black dark:text-zinc-50"
                >
                  Button text
                </label>
                <CharCounter value={buttonText} max={BUTTON_TEXT_MAX} />
              </div>
              <input
                id={buttonTextId}
                type="text"
                dir="auto"
                value={buttonText}
                onChange={(e) => setButtonText(e.target.value)}
                placeholder={DEFAULT_BUTTON_TEXT}
                aria-invalid={Boolean(errors.buttonText)}
                aria-describedby={errors.buttonText ? `${buttonTextId}-error` : undefined}
                className={`${fieldClass} ${borderClass(Boolean(errors.buttonText))}`}
              />
              <FieldError id={`${buttonTextId}-error`} message={errors.buttonText} />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor={urlsId}
                className="text-sm font-medium text-black dark:text-zinc-50"
              >
                Links
              </label>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                One link per line.
              </p>
              <textarea
                id={urlsId}
                dir="auto"
                rows={3}
                value={urlsText}
                onChange={(e) => setUrlsText(e.target.value)}
                placeholder="https://example.com/guide"
                spellCheck={false}
                autoCapitalize="off"
                aria-invalid={Boolean(errors.urls)}
                aria-describedby={errors.urls ? `${urlsId}-error` : undefined}
                className={`${fieldClass} ${borderClass(Boolean(errors.urls))} resize-y`}
              />
              <FieldError id={`${urlsId}-error`} message={errors.urls} />
            </div>

            <DmPreview message={message} buttonText={buttonText} urls={urls} />
          </div>

          {saveError ? (
            <p
              role="alert"
              className="px-6 py-3 text-sm text-red-600 dark:text-red-400"
            >
              {saveError}
            </p>
          ) : null}

          <footer className="flex items-center justify-end gap-3 border-t border-black/[.08] px-6 py-4 dark:border-white/[.145]">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-black/[.08] px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:text-zinc-50 dark:hover:bg-[#1a1a1a]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
            >
              {isSaving ? "Saving…" : isEditing ? "Save changes" : "Create automation"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

function CharCounter({ value, max }: { value: string; max: number }) {
  const count = charCount(value);
  return (
    <span
      className={`text-xs tabular-nums ${
        count > max ? "text-red-600 dark:text-red-400" : "text-zinc-500 dark:text-zinc-400"
      }`}
    >
      {count}/{max}
    </span>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} dir="auto" className="text-xs text-red-600 dark:text-red-400" role="alert">
      {message}
    </p>
  );
}

/** Rough look at the DM as the commenter will see it. */
function DmPreview({
  message,
  buttonText,
  urls,
}: {
  message: string;
  buttonText: string;
  urls: string[];
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-black dark:text-zinc-50">Preview</p>
      <div className="rounded-xl bg-zinc-100 p-4 dark:bg-zinc-900">
        <div className="max-w-[85%] overflow-hidden rounded-2xl bg-white dark:bg-zinc-800">
          <p
            dir="auto"
            className="whitespace-pre-wrap break-words px-4 py-3 text-sm text-black dark:text-zinc-50"
          >
            {message.trim() || (
              <span className="text-zinc-400 dark:text-zinc-500">Your message</span>
            )}
          </p>
          {urls.length > 0 ? (
            <ul className="flex flex-col gap-1 px-4 pb-3">
              {urls.map((url, i) => (
                <li
                  key={`${i}-${url}`}
                  dir="auto"
                  className="truncate text-xs text-blue-600 dark:text-blue-400"
                >
                  {url}
                </li>
              ))}
            </ul>
          ) : null}
          <div
            dir="auto"
            className="border-t border-black/[.08] px-4 py-2.5 text-center text-sm font-medium text-blue-600 dark:border-white/[.1] dark:text-blue-400"
          >
            {buttonText.trim() || DEFAULT_BUTTON_TEXT}
          </div>
        </div>
      </div>
    </div>
  );
}
