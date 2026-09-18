import Link from "next/link";

export default function NewAutomation() {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-6 py-12 sm:px-10">
        <Link
          href="/automations"
          className="text-sm text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          ← Back to automations
        </Link>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
          New automation
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          This form is not built yet.
        </p>
      </main>
    </div>
  );
}
