"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/watchlist", label: "Watchlist" },
  { href: "/predictions", label: "Predictions" },
  { href: "/paper-trades", label: "Paper Trades" },
  { href: "/performance", label: "Performance" },
  { href: "/journal", label: "Journal" },
  { href: "/settings", label: "Settings" },
];

function isActive(href: string, pathname: string | null) {
  if (!pathname) return false;
  return href === "/" ? pathname === "/" || pathname.startsWith("/asset/") : pathname.startsWith(href);
}

/** Static navigation markup; also used as the prerendered fallback (no active highlight). */
export function NavLinks({ pathname = null }: { pathname?: string | null }) {
  return (
    <nav aria-label="Main" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1">
        {NAV.map((item) => {
          const active = isActive(item.href, pathname);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`block rounded-md px-3 py-1.5 text-sm transition-colors ${
                  active ? "bg-panel-2 text-text" : "text-muted hover:bg-panel-2/60 hover:text-text"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function AppNav() {
  return <NavLinks pathname={usePathname()} />;
}
