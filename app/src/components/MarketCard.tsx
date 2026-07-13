"use client";

import { BN } from "@coral-xyz/anchor";
import clsx from "clsx";
import { useNow } from "@/hooks/useNow";
import { formatDateTime, formatUsdc, formatUsdcCompact, pct, poolShare } from "@/lib/format";
import { marketPhase, prizePot, type MarketPhase } from "@/lib/market-view";
import { getTxLineForMatch } from "@/lib/txline";
import { type MarketRecord, sideKey, type SideKey } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Countdown } from "./Countdown";
import { OddsCompare } from "./OddsCompare";
import { PoolBar } from "./PoolBar";
import { StatusBadge } from "./StatusBadge";

export function MarketCard({
  record,
  connected,
  isOperator,
  index = 0,
  onBet,
}: {
  record: MarketRecord;
  connected: boolean;
  isOperator: boolean;
  index?: number;
  onBet: (record: MarketRecord) => void;
}) {
  const now = useNow();
  const m = record.account;
  const matchId = m.matchId.toNumber();
  const phase = marketPhase(m, now);
  const winner = sideKey(m.winnerSide);
  const yesShare = poolShare(m.yesPrincipal, m.noPrincipal);
  const pot = prizePot(m);
  const txline = getTxLineForMatch(matchId);
  const kickoff = m.kickoffTs.toNumber();
  const bettingOpen = phase === "betting";

  return (
    <article
      className="panel flex animate-rise-in flex-col gap-4 p-5"
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
    >
      {/* top strip */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="led text-[11px] text-mist">MATCH #{matchId}</span>
          {isOperator && (
            <span className="kit-label rounded bg-flood/15 px-1.5 py-0.5 text-[9px] text-flood">
              you run this
            </span>
          )}
        </div>
        <StatusBadge phase={phase} winner={winner} />
      </div>

      {/* fixture + proposition */}
      <div>
        {txline && (
          <div className="mb-1.5 flex items-center gap-2 font-display text-lg font-semibold uppercase tracking-wide text-chalk">
            <span>{txline.home}</span>
            <span className="text-[11px] text-mist">vs</span>
            <span className="text-chalk-dim">{txline.away}</span>
          </div>
        )}
        <h3 className="font-display text-2xl font-bold uppercase leading-tight tracking-wide text-chalk">
          {m.proposition}
        </h3>
      </div>

      {/* the scoreboard: YES vs NO */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-2">
        <TeamPanel side="yes" pool={m.yesPrincipal} share={yesShare} phase={phase} winner={winner} />
        <div className="flex flex-col items-center justify-center px-1">
          <span className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-pitch-800 font-display text-xs font-bold text-mist">
            VS
          </span>
        </div>
        <TeamPanel side="no" pool={m.noPrincipal} share={1 - yesShare} phase={phase} winner={winner} />
      </div>

      <PoolBar yesShare={yesShare} />

      {/* odds comparison */}
      <OddsCompare matchId={matchId} yesPrincipal={m.yesPrincipal} noPrincipal={m.noPrincipal} />

      {/* footer: prize pot + kickoff + action */}
      <div className="mt-auto flex flex-wrap items-end justify-between gap-3 border-t border-white/8 pt-4">
        <div className="flex items-center gap-5">
          <Stat
            label={phase === "settled" ? "Winners take" : "Prize pot · yield"}
            value={formatUsdc(pot)}
            accent
            emphasize={phase === "settled" && !pot.isZero()}
          />
          <Stat
            label={bettingOpen ? "Betting closes" : phase === "settled" ? "Settled" : "Kickoff"}
            value={
              phase === "settled" ? (
                formatDateTime(m.settledTs.toNumber())
              ) : (
                <Countdown targetUnix={kickoff} doneLabel="Kicked off" />
              )
            }
          />
        </div>

        <Button
          variant="flood"
          size="md"
          disabled={!bettingOpen || !connected}
          onClick={() => onBet(record)}
          title={!connected ? "Connect a wallet to bet" : undefined}
        >
          {bettingOpen ? (connected ? "Back a side" : "Connect to bet") : "Betting closed"}
        </Button>
      </div>
    </article>
  );
}

function TeamPanel({
  side,
  pool,
  share,
  phase,
  winner,
}: {
  side: SideKey;
  pool: BN;
  share: number;
  phase: MarketPhase;
  winner: SideKey | null;
}) {
  const isYes = side === "yes";
  const settled = phase === "settled";
  const isWinner = settled && winner === side;
  const isLoser = settled && winner !== null && winner !== side;
  const color = isYes ? "text-yes" : "text-no";

  return (
    <div
      className={clsx(
        "relative overflow-hidden rounded-2xl border p-4 transition-all",
        isYes ? "border-yes/25 bg-yes/[0.06]" : "border-no/25 bg-no/[0.06]",
        isWinner && (isYes ? "shadow-[0_0_0_1px_var(--yes),0_0_30px_-6px_var(--yes)]" : "shadow-[0_0_0_1px_var(--no),0_0_30px_-6px_var(--no)]"),
        isLoser && "opacity-55 grayscale-[0.3]",
      )}
    >
      <div className="flex items-center justify-between">
        <span className={clsx("kit-label text-sm", color)}>{isYes ? "Yes" : "No"}</span>
        {isWinner && (
          <span className={clsx("kit-label text-[10px]", color)} title="Winning side">
            ★ winner
          </span>
        )}
      </div>
      <div className={clsx("led led-glow mt-2 text-3xl font-bold leading-none", color)}>
        {formatUsdcCompact(pool)}
      </div>
      <div className="led mt-1 text-[11px] text-mist">{pct(share)} implied</div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  emphasize,
}: {
  label: string;
  value: React.ReactNode;
  accent?: boolean;
  emphasize?: boolean;
}) {
  return (
    <div>
      <div className="kit-label text-[10px] text-mist">{label}</div>
      <div
        className={clsx(
          "led text-lg font-bold leading-tight",
          accent ? "text-flood" : "text-chalk",
          emphasize && "animate-pot-pop led-glow",
        )}
      >
        {value}
      </div>
    </div>
  );
}
