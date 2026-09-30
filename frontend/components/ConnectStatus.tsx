/** Body of an account-connection page: a spinner while working, or an outcome plus actions. */
export default function ConnectStatus({
  title,
  message,
  isWorking = false,
  isError = false,
  children,
}: {
  title: string;
  message?: string;
  isWorking?: boolean;
  isError?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <>
      {isWorking ? (
        <span
          aria-hidden
          className="h-6 w-6 animate-spin rounded-full border-2 border-black/10 border-t-black dark:border-white/15 dark:border-t-zinc-50"
        />
      ) : null}
      <h1
        className="mt-4 text-lg font-semibold tracking-tight text-black dark:text-zinc-50"
        role={isError ? "alert" : "status"}
      >
        {title}
      </h1>
      {message ? (
        <p
          className={`mt-1 text-sm ${
            isError
              ? "text-red-600 dark:text-red-400"
              : "text-zinc-600 dark:text-zinc-400"
          }`}
        >
          {message}
        </p>
      ) : null}
      {children ? (
        <div className="mt-6 flex items-center gap-3">{children}</div>
      ) : null}
    </>
  );
}
