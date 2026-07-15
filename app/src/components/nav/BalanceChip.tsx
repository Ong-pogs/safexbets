"use client";

import { PublicKey } from "@solana/web3.js";
import clsx from "clsx";
import { useEffect, useMemo, useRef, useState } from "react";
import { useProgram } from "@/hooks/useProgram";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import { CONFIG, IS_PRINCIPAL_MINT_MISSING, explorerUrl } from "@/lib/config";
import { PRINCIPAL_SYMBOL, SOL_FAUCET_URL, USDC_FAUCET_URL } from "@/lib/constants";
import { shortAddr } from "@/lib/format";

const REFRESH_MS = 30_000;

/**
 * The bankroll chip: the connected wallet's balance of the app's principal mint (Circle devnet
 * USDC). Clicking opens the faucet popover — the devnet stand-in for a sportsbook's "Deposit"
 * button: self-fund at faucet.circle.com, copy your address, top up SOL for fees.
 */
export function BalanceChip() {
  const { connection, wallet } = useProgram();
  const owner = wallet?.publicKey;

  const mint = useMemo(() => {
    if (IS_PRINCIPAL_MINT_MISSING) return undefined;
    try {
      return new PublicKey(CONFIG.principalMint);
    } catch {
      return undefined;
    }
  }, []);

  const { amount, reload } = useTokenBalance(connection, owner, mint);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Keep the bankroll fresh: poll + refetch when the tab regains focus (post-faucet return trip).
  useEffect(() => {
    if (!owner) return;
    const id = setInterval(() => void reload(), REFRESH_MS);
    const onFocus = () => void reload();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [owner, reload]);

  // Dismiss on outside click / Escape.
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

  if (!owner || !mint) return null;

  return (
    <div ref={rootRef} className="relative hidden sm:block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Balance ${amount ?? 0} ${PRINCIPAL_SYMBOL} on devnet — open faucet options`}
        className={clsx(
          "flex items-center gap-2 rounded-full border px-3 py-1.5 transition",
          open
            ? "border-flood/50 bg-flood/[0.08]"
            : "border-white/10 hover:border-flood/40 hover:bg-white/[0.03]",
        )}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-flood" aria-hidden />
        <span className="led text-xs font-bold text-chalk">
          {amount == null ? "—" : amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </span>
        <span className="kit-label text-[9px] leading-none text-mist">
          {PRINCIPAL_SYMBOL} · {CONFIG.network}
        </span>
        <svg
          width="8"
          height="5"
          viewBox="0 0 8 5"
          aria-hidden
          className={clsx("text-mist transition-transform", open && "rotate-180")}
        >
          <path d="M1 1l3 3 3-3" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" />
        </svg>
      </button>

      {open && <FaucetPopover owner={owner.toBase58()} amount={amount} />}
    </div>
  );
}

function FaucetPopover({ owner, amount }: { owner: string; amount: number | null }) {
  const [copied, setCopied] = useState(false);

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(owner);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked — the address is still visible to select manually */
    }
  }

  return (
    <div
      role="dialog"
      aria-label="Devnet funding"
      className="panel absolute right-0 top-full z-50 mt-2 w-72 animate-rise-in p-4"
    >
      <div className="flex items-end justify-between gap-2">
        <div>
          <div className="kit-label text-[10px] text-mist">Bankroll</div>
          <div className="led text-2xl font-bold leading-tight text-chalk">
            {amount == null ? "—" : amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </div>
        </div>
        <span className="kit-label rounded-full border border-white/10 px-2 py-0.5 text-[9px] text-chalk-dim">
          {PRINCIPAL_SYMBOL} · devnet
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-white/8 bg-pitch-800/60 px-3 py-2">
        <a
          href={explorerUrl("address", owner)}
          target="_blank"
          rel="noreferrer"
          className="led text-[11px] text-chalk-dim underline-offset-2 hover:text-flood hover:underline"
          title="View wallet on Solana Explorer"
        >
          {shortAddr(owner, 6, 6)}
        </a>
        <button
          type="button"
          onClick={copyAddress}
          className={clsx(
            "kit-label rounded-lg border px-2 py-1 text-[9px] transition",
            copied
              ? "border-yes/50 text-yes"
              : "border-white/15 text-mist hover:border-flood/50 hover:text-flood",
          )}
        >
          {copied ? "Copied ✓" : "Copy address"}
        </button>
      </div>

      <a
        href={USDC_FAUCET_URL}
        target="_blank"
        rel="noreferrer"
        className="kit-label mt-3 flex items-center justify-between rounded-xl bg-flood px-3.5 py-2.5 text-[11px] text-pitch-900 transition hover:shadow-[0_10px_26px_-10px_rgba(203,255,62,0.6)]"
      >
        Get devnet USDC — faucet.circle.com
        <span aria-hidden>↗</span>
      </a>
      <a
        href={SOL_FAUCET_URL}
        target="_blank"
        rel="noreferrer"
        className="kit-label mt-2 flex items-center justify-between rounded-xl border border-white/15 px-3.5 py-2.5 text-[11px] text-chalk transition hover:border-flood/50 hover:text-flood"
      >
        Devnet SOL for fees
        <span aria-hidden>↗</span>
      </a>

      <p className="mt-3 text-[10px] leading-relaxed text-mist">
        Pick your copied address on the faucet, choose <span className="text-chalk-dim">Solana devnet</span>.
        Stakes pay out in the same token — principal always comes back.
      </p>
    </div>
  );
}
