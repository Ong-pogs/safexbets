"use client";

import clsx from "clsx";
import type { MarketPhase } from "@/lib/market-view";
import type { SideKey } from "@/lib/types";

const CONFIG: Record<
  MarketPhase,
  { label: string; className: string; live?: boolean; dot: string }
> = {
  betting: {
    label: "Betting Open",
    className: "text-yes border-yes/40 bg-yes/10",
    live: true,
    dot: "bg-yes",
  },
  in_play: {
    label: "In Play",
    className: "text-flood border-flood/40 bg-flood/10",
    live: true,
    dot: "bg-flood",
  },
  settled: {
    label: "Settled",
    className: "text-chalk border-white/20 bg-white/5",
    dot: "bg-chalk",
  },
  void: {
    label: "Void · Refunded",
    className: "text-mist border-white/15 bg-white/5",
    dot: "bg-mist",
  },
};

export function StatusBadge({
  phase,
  winner,
}: {
  phase: MarketPhase;
  winner?: SideKey | null;
}) {
  const c = CONFIG[phase];
  const label =
    phase === "settled" && winner ? `Settled · ${winner.toUpperCase()} wins` : c.label;

  return (
    <span
      className={clsx(
        "kit-label inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px]",
        c.className,
      )}
    >
      <span className="relative flex h-2 w-2">
        {c.live && (
          <span
            className={clsx("absolute inline-flex h-full w-full animate-live-pulse rounded-full", c.dot)}
          />
        )}
        <span className={clsx("relative inline-flex h-2 w-2 rounded-full", c.dot)} />
      </span>
      {label}
    </span>
  );
}
