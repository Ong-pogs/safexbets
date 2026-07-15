"use client";

import clsx from "clsx";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useProgram } from "@/hooks/useProgram";
import { CONFIG } from "@/lib/config";
import { BalanceChip } from "./BalanceChip";
import { NAV_ITEMS } from "./navItems";

// Wallet button renders differently per wallet state — load client-only to avoid hydration drift.
const WalletButton = dynamic(
  async () => (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false, loading: () => <div className="h-10 w-36 animate-pulse rounded-xl bg-white/5" /> },
);

/**
 * Primary navigation. Desktop: sticky navbar — brand, section links with active states, balance
 * chip (faucet popover), wallet, and an operator overflow that only appears once a wallet is
 * connected. Mobile: a slim top bar (brand + wallet); section tabs live in the BottomTabBar.
 */
export function AppNav() {
  const pathname = usePathname() ?? "/";

  return (
    <header className="sticky top-0 z-40 border-b border-white/8 bg-pitch-900/70 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
        <div className="flex min-w-0 items-center gap-6">
          <Link href="/" className="flex shrink-0 items-center gap-3" aria-label="SafeXBets home">
            <Crest />
            <span className="leading-none">
              <span className="block font-display text-xl font-bold uppercase tracking-[0.08em] text-chalk">
                Safe<span className="text-flood">X</span>Bets
              </span>
              <span className="mt-0.5 hidden text-[10px] text-mist lg:block">
                You stake time, not money.
              </span>
            </span>
          </Link>

          <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
            {NAV_ITEMS.map((item) => {
              const active = item.isActive(pathname);
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={clsx(
                    "kit-label relative rounded-lg px-3 py-2 text-[11px] transition",
                    active ? "text-flood" : "text-chalk-dim hover:bg-white/5 hover:text-chalk",
                  )}
                >
                  {item.label}
                  {/* gantry-light active indicator */}
                  <span
                    className={clsx(
                      "absolute inset-x-3 -bottom-[11px] h-0.5 rounded-full transition",
                      active ? "bg-flood shadow-[0_0_10px_var(--flood)]" : "bg-transparent",
                    )}
                    aria-hidden
                  />
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <BalanceChip />
          <WalletButton />
          <OperatorOverflow pathname={pathname} />
        </div>
      </div>
    </header>
  );
}

/** "⋯" overflow with the operator booth link — rendered only when a wallet is connected. */
function OperatorOverflow({ pathname }: { pathname: string }) {
  const { wallet } = useProgram();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Close the menu after navigating.
  useEffect(() => setOpen(false), [pathname]);

  if (!wallet?.publicKey) return null;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="More"
        className={clsx(
          "grid h-10 w-8 place-items-center rounded-lg border text-chalk-dim transition",
          open ? "border-flood/50 text-flood" : "border-white/10 hover:border-white/25 hover:text-chalk",
        )}
      >
        <svg width="3" height="13" viewBox="0 0 3 13" aria-hidden>
          <circle cx="1.5" cy="1.5" r="1.5" fill="currentColor" />
          <circle cx="1.5" cy="6.5" r="1.5" fill="currentColor" />
          <circle cx="1.5" cy="11.5" r="1.5" fill="currentColor" />
        </svg>
      </button>
      {open && (
        <div role="menu" className="panel absolute right-0 top-full z-50 mt-2 w-56 animate-rise-in p-1.5">
          <Link
            href="/operator"
            role="menuitem"
            className={clsx(
              "block rounded-lg px-3 py-2.5 transition hover:bg-white/5",
              pathname === "/operator" && "bg-flood/[0.08]",
            )}
          >
            <span className="kit-label block text-[11px] text-chalk">Operator booth</span>
            <span className="mt-0.5 block text-[10px] leading-snug text-mist">
              Manual market control — the keeper runs markets automatically
            </span>
          </Link>
          <div className="mx-3 my-1 chalk-hr" />
          <div className="px-3 pb-1.5 pt-1">
            <span className="kit-label inline-flex items-center gap-1.5 text-[9px] text-chalk-dim">
              <span className="h-1.5 w-1.5 rounded-full bg-flood" aria-hidden />
              {CONFIG.network}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function Crest() {
  return (
    <svg width="34" height="34" viewBox="0 0 32 32" aria-hidden className="shrink-0">
      <rect width="32" height="32" rx="8" fill="#0A2114" stroke="#1C4A2E" />
      <circle cx="16" cy="16" r="9" fill="none" stroke="#1C4A2E" strokeWidth="1.4" />
      <path d="M16 9l5 3.6-1.9 5.9h-6.2L11 12.6z" fill="#CBFF3E" />
      <circle cx="16" cy="16" r="2.2" fill="#0A2114" />
    </svg>
  );
}
