"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "../lib/useSession";

/** Sends already-signed-in users to /home instead of showing login/signup. */
export default function RedirectIfAuthenticated({
  children,
}: {
  children: React.ReactNode;
}) {
  const status = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/home");
    }
  }, [status, router]);

  if (status !== "unauthenticated") return null;

  return <>{children}</>;
}
