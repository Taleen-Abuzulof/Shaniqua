import Link from "next/link";

export default function Landing() {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-6 py-12 text-center">
        <span className="text-sm font-semibold tracking-tight text-black dark:text-zinc-50">
          Shaniqua
        </span>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-black sm:text-4xl dark:text-zinc-50">
          Turn Instagram comments into DMs, automatically.
        </h1>
        <p className="mt-4 max-w-lg text-sm text-zinc-600 dark:text-zinc-400">
          Connect your Instagram professional account, pick a post or reel,
          and send an instant private reply whenever someone comments a
          keyword you choose.
        </p>
        <div className="mt-8 flex items-center gap-3">
          <Link
            href="/signup"
            className="flex h-10 items-center justify-center rounded-full bg-foreground px-5 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
          >
            Get started
          </Link>
          <Link
            href="/login"
            className="flex h-10 items-center justify-center rounded-full border border-black/[.08] px-5 text-sm font-medium text-black transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:text-zinc-50 dark:hover:bg-white/[.06]"
          >
            Log in
          </Link>
        </div>
      </main>
    </div>
  );
}
