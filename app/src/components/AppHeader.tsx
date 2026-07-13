"use client";

import dynamic from "next/dynamic";
import { CONFIG } from "@/lib/config";
import { PRINCIPAL_SYMBOL } from "@/lib/constants";

// Wallet button renders differently per wallet state — load client-only to avoid hydration drift.
const WalletButton = dynamic(
  async () => (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false, loading: () => <div className="h-10 w-36 animate-pulse rounded-xl bg-white/5" /> },
);

export function AppHeader({ balance }: { balance: number | null }) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/8 bg-pitch-900/70 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <Crest />
          <div className="leading-none">
            <div className="font-display text-xl font-bold uppercase tracking-[0.08em] text-chalk">
              Safe<span className="text-flood">X</span>Bets
            </div>
            <div className="mt-0.5 hidden text-[11px] text-mist sm:block">
              You stake time, not money.
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <span className="kit-label hidden items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-[10px] text-chalk-dim sm:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-flood" />
            {CONFIG.network}
          </span>
          {balance != null && (
            <span className="led hidden rounded-full border border-white/10 px-3 py-1.5 text-xs text-chalk sm:inline-block">
              {balance.toLocaleString(undefined, { maximumFractionDigits: 2 })} {PRINCIPAL_SYMBOL}
            </span>
          )}
          <WalletButton />
        </div>
      </div>
    </header>
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
