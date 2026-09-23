export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-6 py-12 sm:px-10">
        <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Home
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          This page is not built yet.
        </p>
        <button
          type="button"
          className="mt-6 w-fit rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-black dark:hover:bg-zinc-200"
        >
          Connect Instagram
        </button>
      </main>
    </div>
  );
}
