import Link from "next/link";

type Automation = {
  id: string;
  name: string;
  trigger: string;
  media: string;
  status: "active" | "paused";
  deliveryRate: string;
  avgLatencyMs: number;
  volume: number;
};

const automations: Automation[] = [
  {
    id: "1",
    name: "Free guide DM",
    trigger: "\"GUIDE\"",
    media: "Reel: 5 tips for...",
    status: "active",
    deliveryRate: "99.2%",
    avgLatencyMs: 1180,
    volume: 342,
  },
  {
    id: "2",
    name: "Discount code",
    trigger: "\"SALE\"",
    media: "Post: New drop 🔥",
    status: "active",
    deliveryRate: "98.7%",
    avgLatencyMs: 1340,
    volume: 128,
  },
  {
    id: "3",
    name: "Waitlist signup",
    trigger: "\"WAITLIST\"",
    media: "Reel: behind the scenes",
    status: "paused",
    deliveryRate: "—",
    avgLatencyMs: 0,
    volume: 0,
  },
];

function StatusBadge({ status }: { status: Automation["status"] }) {
  const isActive = status === "active";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        isActive
          ? "bg-green-100 text-green-800 dark:bg-green-500/10 dark:text-green-400"
          : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          isActive ? "bg-green-500" : "bg-zinc-400"
        }`}
      />
      {isActive ? "Active" : "Paused"}
    </span>
  );
}

export default function Automations() {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-6 py-12 sm:px-10">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
              Automations
            </h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Manage the automated DMs triggered by comments on your posts and reels.
            </p>
          </div>
          <Link
            href="/automations/new"
            className="flex h-10 shrink-0 items-center justify-center rounded-full bg-foreground px-5 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
          >
            Add automation
          </Link>
        </div>

        <div className="mt-8">
          {automations.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-black/[.08] px-6 py-20 text-center dark:border-white/[.145]">
              <p className="text-base font-medium text-black dark:text-zinc-50">
                No automations yet
              </p>
              <p className="mt-1 max-w-sm text-sm text-zinc-600 dark:text-zinc-400">
                Create your first automation to start sending automatic DMs when
                people comment on your posts or reels.
              </p>
              <Link
                href="/automations/new"
                className="mt-6 flex h-10 items-center justify-center rounded-full bg-foreground px-5 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
              >
                Add automation
              </Link>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {automations.map((automation) => (
                <li
                  key={automation.id}
                  className="rounded-2xl border border-black/[.08] bg-white px-5 py-4 dark:border-white/[.145] dark:bg-[#0a0a0a]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <h2 className="text-sm font-semibold text-black dark:text-zinc-50">
                          {automation.name}
                        </h2>
                        <StatusBadge status={automation.status} />
                      </div>
                      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                        Trigger {automation.trigger} on {automation.media}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-4 border-t border-black/[.06] pt-3 dark:border-white/[.08]">
                    <div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-500">
                        Delivery rate
                      </p>
                      <p className="mt-0.5 text-sm font-medium text-black dark:text-zinc-50">
                        {automation.deliveryRate}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-500">
                        Avg. latency
                      </p>
                      <p className="mt-0.5 text-sm font-medium text-black dark:text-zinc-50">
                        {automation.avgLatencyMs > 0
                          ? `${automation.avgLatencyMs}ms`
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-500">
                        DMs sent
                      </p>
                      <p className="mt-0.5 text-sm font-medium text-black dark:text-zinc-50">
                        {automation.volume}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
