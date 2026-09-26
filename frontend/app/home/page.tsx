import InstagramHome, {
  type InstagramConnectResult,
} from "../../components/InstagramHome";

const CONNECT_RESULTS: InstagramConnectResult[] = ["connected", "cancelled"];

export default async function Home({ searchParams }: PageProps<"/home">) {
  const { instagram } = await searchParams;
  const connectResult = CONNECT_RESULTS.find((r) => r === instagram);

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-12 sm:px-10">
        <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Home
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Your Instagram reels, synced from your connected account.
        </p>
        <InstagramHome connectResult={connectResult} />
      </main>
    </div>
  );
}
