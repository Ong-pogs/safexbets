"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "./navItems";

/**
 * Mobile bottom tab bar (hidden ≥ md, where the navbar carries the links). Fixed, blurred, with
 * safe-area padding for gesture-nav phones. The active tab gets a floodlit gantry bar on top.
 */
export function BottomTabBar() {
  const pathname = usePathname() ?? "/";

  return (
    <nav
      aria-label="Primary tabs"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/8 bg-pitch-900/85 backdrop-blur-md md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="grid grid-cols-3">
        {NAV_ITEMS.map((item) => {
          const active = item.isActive(pathname);
          const Icon = item.icon;
          return (
            <Link
              key={item.key}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={clsx(
                "relative flex flex-col items-center gap-1 pb-2 pt-2.5 transition",
                active ? "text-flood" : "text-mist hover:text-chalk-dim",
              )}
            >
              <span
                className={clsx(
                  "absolute top-0 h-0.5 w-9 rounded-b-full transition",
                  active ? "bg-flood shadow-[0_0_12px_var(--flood)]" : "bg-transparent",
                )}
                aria-hidden
              />
              <Icon className="h-[22px] w-[22px]" />
              <span className="kit-label text-[9px] leading-none">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
