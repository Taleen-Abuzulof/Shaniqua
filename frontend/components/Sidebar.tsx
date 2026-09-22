"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signOut } from "../lib/api";

const navItems = [
  { href: "/home", label: "Home" },
  { href: "/automations", label: "Automations" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    function handlePointerDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  function handleSignOut() {
    signOut();
    setMenuOpen(false);
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-black/[.08] bg-white px-4 py-6 dark:border-white/[.145] dark:bg-[#0a0a0a]">
      <span className="px-2 text-sm font-semibold tracking-tight text-black dark:text-zinc-50">
        Shaniqua
      </span>
      <nav className="mt-6 flex flex-col gap-1">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-black/[.06] text-black dark:bg-white/[.08] dark:text-zinc-50"
                  : "text-zinc-600 hover:bg-black/[.04] hover:text-black dark:text-zinc-400 dark:hover:bg-white/[.06] dark:hover:text-zinc-50"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div ref={menuRef} className="relative mt-auto">
        {menuOpen ? (
          <div className="absolute bottom-full left-0 mb-2 w-full overflow-hidden rounded-lg border border-black/[.08] bg-white py-1 shadow-lg dark:border-white/[.145] dark:bg-[#0a0a0a]">
            <button
              type="button"
              disabled
              title="Coming soon"
              className="flex w-full cursor-not-allowed items-center px-3 py-2 text-left text-sm font-medium text-zinc-400 dark:text-zinc-600"
            >
              Settings
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="flex w-full items-center px-3 py-2 text-left text-sm font-medium text-zinc-600 transition-colors hover:bg-black/[.04] hover:text-black dark:text-zinc-400 dark:hover:bg-white/[.06] dark:hover:text-zinc-50"
            >
              Sign out
            </button>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-black/[.04] dark:hover:bg-white/[.06]"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/[.06] text-zinc-600 dark:bg-white/[.08] dark:text-zinc-400">
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-4.42 0-8 2.24-8 5v1a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-1c0-2.76-3.58-5-8-5Z" />
            </svg>
          </span>
          <span className="text-sm font-medium text-black dark:text-zinc-50">
            Profile
          </span>
        </button>
      </div>
    </aside>
  );
}
