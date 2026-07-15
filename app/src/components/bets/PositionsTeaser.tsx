"use client";

import clsx from "clsx";
import Link from "next/link";
import { useMemo } from "react";
import { Countdown } from "@/components/Countdown";
import { PRINCIPAL_SYMBOL } from "@/lib/constants";
import { formatUsdc } from "@/lib/format";
import { claimEstimate, positionState, type PositionState } from "@/lib/market-view";
import { type MarketRecord, type PositionRecord, sideKey } from "@/lib/types";

const TEASER_LIMIT = 3;

const CHIP: Record<PositionState, { label: React.ReactNode; cls: string }> = {
  open: { label: "Open", cls: "text-flood" },
  claimable: { label: <>Claimable 💰</>, cls: "text-yes" },
  locked: { label: <>Locked ⏳</>, cls: "text-no" },
  recoverable: { label: <>Recoverable ↩</>, cls: "text-chalk" },
  collected: { label: <>Collected ✓</>, cls: "text-mist" },
  recovered: { label: <>Recovered ✓</>, cls: "text-mist" },
  void: { label: <>Void ↩</>, cls: "text-mist" },
};

/**
 * Compact "recent positions" strip for the home page — a teaser for /my-bets, where the full
 * betslip tracker (tabs, aggregates, claim/withdraw) lives. Renders nothing without positions.
 */
export function PositionsTeaser({
  positions,
  markets,
}: {
  positions: PositionRecord[];
  markets: MarketRecord[];
}) {
  const rows = useMemo(() => {
    const byKey = new Map(markets.map((m) => [m.publicKey.toBase58(), m]));
    return positions
      .map((p) => {
        const market = byKey.get(p.account.market.toBase58());
        return market ? { position: p, market, state: positionState(market.account, p.account) } : null;
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => b.market.account.kickoffTs.cmp(a.market.account.kickoffTs));
  }, [positions, markets]);

  if (rows.length === 0) return null;

  const actionable = rows.filter((r) => r.state === "claimable" || r.state === "recoverable").length;

  return (
    <section aria-label="Your recent positions">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-xl font-bold uppercase tracking-wide text-chalk">Your bets</h2>
          <span className="led rounded-full bg-white/5 px-2 py-0.5 text-xs text-mist">{rows.length}</span>
          {actionable > 0 && (
            <span className="kit-label rounded-full border border-yes/30 bg-yes/10 px-2.5 py-0.5 text-[10px] text-yes">
              {actionable} to collect
            </span>
          )}
        </div>
        <Link
          href="/my-bets"
          className="kit-label rounded-lg px-2 py-1 text-[11px] text-flood transition hover:bg-flood/10"
        >
          My Bets →
        </Link>
      </div>

      <div className="panel divide-y divide-white/8">
        {rows.slice(0, TEASER_LIMIT).map(({ position, market, state }) => {
          const m = market.account;
          const side = sideKey(position.account.side);
          return (
            <Link
              key={position.publicKey.toBase58()}
              href="/my-bets"
              className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-white/[0.03]"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-chalk">{m.proposition}</div>
                <div className="mt-0.5 flex items-center gap-2 text-[11px]">
                  <span className={clsx("kit-label", side === "yes" ? "text-yes" : "text-no")}>
                    {side?.toUpperCase()}
                  </span>
                  <span className="led text-mist">
                    {formatUsdc(position.account.principal)} {PRINCIPAL_SYMBOL}
                  </span>
                </div>
              </div>
              <span className={clsx("kit-label shrink-0 text-[10px]", CHIP[state].cls)}>
                {CHIP[state].label}
                {state === "locked" && (
                  <span className="led ml-1.5 normal-case tracking-normal">
                    <Countdown targetUnix={m.loserUnlockTs.toNumber()} doneLabel="now" />
                  </span>
                )}
                {state === "claimable" && (
                  <span className="led ml-1.5 normal-case tracking-normal">
                    {formatUsdc(claimEstimate(m, position.account))}
                  </span>
                )}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
