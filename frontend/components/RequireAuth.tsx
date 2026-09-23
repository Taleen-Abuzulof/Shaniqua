"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "../lib/useSession";

/** Gates its children behind a valid session, redirecting to /login otherwise. */
export default function RequireAuth({
  children,
}: {
  children: React.ReactNode;
}) {
  const status = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  if (status !== "authenticated") return null;

  return <>{children}</>;
}
