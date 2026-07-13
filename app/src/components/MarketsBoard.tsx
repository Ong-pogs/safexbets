"use client";

import type { PublicKey } from "@solana/web3.js";
import { MarketCard } from "./MarketCard";
import type { MarketRecord } from "@/lib/types";

export function MarketsBoard({
  markets,
  loading,
  error,
  connected,
  owner,
  onBet,
}: {
  markets: MarketRecord[];
  loading: boolean;
  error: string | null;
  connected: boolean;
  owner: PublicKey | undefined;
  onBet: (record: MarketRecord) => void;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-xl font-bold uppercase tracking-wide text-chalk">
            Live Markets
          </h2>
          <span className="led rounded-full bg-white/5 px-2 py-0.5 text-xs text-mist">
            {markets.length}
          </span>
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded-xl border border-alert/25 bg-alert/[0.06] px-4 py-3 text-sm text-alert">
          {error}
        </div>
      )}

      {loading && markets.length === 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="panel h-80 animate-pulse opacity-60" />
          ))}
        </div>
      ) : markets.length === 0 ? (
        <div className="panel flex flex-col items-center gap-2 p-12 text-center">
          <span className="text-3xl">⚽</span>
          <p className="font-display text-lg uppercase tracking-wide text-chalk">No markets yet</p>
          <p className="max-w-sm text-sm text-mist">
            Open <span className="text-chalk-dim">Match Control</span> below to create the first demo
            market, then back a side. Winners take the losers&apos; yield — nobody loses principal.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {markets.map((r, i) => (
            <MarketCard
              key={r.publicKey.toBase58()}
              record={r}
              index={i}
              connected={connected}
              isOperator={!!owner && r.account.authority.equals(owner)}
              onBet={onBet}
            />
          ))}
        </div>
      )}
    </section>
  );
}
