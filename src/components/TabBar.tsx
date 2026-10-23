"use client";

import { BookOpen, Church, Flame, Sun, User, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

// The bulletin lives under Sunday: its pages mark that tab as current.
const tabs: { href: string; label: string; Icon: LucideIcon; also?: string[] }[] = [
  { href: "/", label: "Today", Icon: Sun },
  { href: "/sunday", label: "Sunday", Icon: BookOpen, also: ["/bulletin"] },
  { href: "/mass", label: "Mass", Icon: Church },
  { href: "/prayers", label: "Prayers", Icon: Flame },
  { href: "/me", label: "Me", Icon: User },
];

function isActive(pathname: string, href: string, also: string[] = []) {
  if (href === "/") return pathname === "/";
  return [href, ...also].some((h) => pathname === h || pathname.startsWith(`${h}/`));
}

export function TabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background pb-[env(safe-area-inset-bottom)] md:sticky md:top-0 md:bottom-auto md:border-t-0 md:border-b md:pb-0"
    >
      <ul className="mx-auto flex max-w-[34em] md:justify-center md:gap-4">
        {tabs.map(({ href, label, Icon, also }) => {
          const active = isActive(pathname, href, also);
          return (
            <li key={href} className="flex-1 md:flex-none">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`-mt-px flex min-h-14 touch-manipulation flex-col items-center justify-center gap-0.5 border-t-2 px-1 text-xs tracking-[0.05em] transition-colors duration-200 ease-out focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring md:min-h-12 md:flex-row md:gap-2 md:px-4 md:text-sm ${
                  active
                    ? "border-accent text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon size={20} strokeWidth={1.5} aria-hidden="true" />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
