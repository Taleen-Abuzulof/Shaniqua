import type { Metadata } from "next";

// Pages for third-party account connections (OAuth redirect targets). The OAuth `code` and
// `state` land in this URL, so never leak it via Referer and keep it out of
// search indexes (response headers in next.config.ts add framing/cache rules).
export const metadata: Metadata = {
  title: "Connect account · Shaniqua",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export default function ConnectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center px-6 py-12 text-center">
        {children}
      </main>
    </div>
  );
}
