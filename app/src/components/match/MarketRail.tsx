"use client";

import type { PublicKey } from "@solana/web3.js";
import clsx from "clsx";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { BetModal } from "@/components/BetModal";
import { Countdown } from "@/components/Countdown";
import { OddsCompare } from "@/components/OddsCompare";
import { PoolBar } from "@/components/PoolBar";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/Button";
import { useMarkets } from "@/hooks/useMarkets";
import { useNow } from "@/hooks/useNow";
import { usePositions } from "@/hooks/usePositions";
import { useProgram } from "@/hooks/useProgram";
import { CONFIG } from "@/lib/config";
import { PRINCIPAL_SYMBOL } from "@/lib/constants";
import { prettifyError } from "@/lib/errors";
import { formatUsdc, formatUsdcCompact, pct, poolShare } from "@/lib/format";
import {
  canClaim,
  canWithdraw,
  claimEstimate,
  isLockedLoser,
  marketPhase,
  positionRole,
  prizePot,
} from "@/lib/market-view";
import { sendClaim, sendWithdrawPrincipal } from "@/lib/program";
import { type MarketRecord, type PositionRecord, sideKey } from "@/lib/types";

/**
 * The on-chain side of the Match Center: finds the market whose `matchId` equals this TxLINE
 * fixture id and reuses the app's existing bet / claim / withdraw flows. Everything here is real
 * devnet state — the honest counterpart to the replay on the left.
 */
export function MarketRail({ fixtureId }: { fixtureId: number }) {
  const { program, connection, wallet } = useProgram();
  const owner = wallet?.publicKey;
  const now = useNow();

  const { markets, loading, error, reload: reloadMarkets } = useMarkets(program);
  const { positions, reload: reloadPositions } = usePositions(program, owner);

  const record = useMemo(
    () => markets.find((m) => m.account.matchId.toNumber() === fixtureId) ?? null,
    [markets, fixtureId],
  );
  const position = useMemo(
    () =>
      record
        ? (positions.find((p) => p.account.market.equals(record.publicKey)) ?? null)
        : null,
    [positions, record],
  );

  const [betRecord, setBetRecord] = useState<MarketRecord | null>(null);

  const reloadAll = useCallback(() => {
    void reloadMarkets();
    void reloadPositions();
  }, [reloadMarkets, reloadPositions]);

  return (
    <aside className="flex h-fit flex-col gap-3 lg:sticky lg:top-20" aria-label="On-chain market">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-sm font-bold uppercase tracking-wide text-chalk">
          Back your call
        </h2>
        <span className="kit-label rounded-full border border-white/10 px-2 py-0.5 text-[9px] text-chalk-dim">
          On-chain · {CONFIG.network}
        </span>
      </div>

      {error && (
        <div className="rounded-xl border border-alert/25 bg-alert/[0.06] px-3 py-2.5 text-xs text-alert">
          {error}
          <button onClick={() => void reloadMarkets()} className="ml-2 underline underline-offset-2">
            Retry
          </button>
        </div>
      )}

      {loading && !record ? (
        <div className="panel h-72 animate-pulse opacity-60" aria-hidden />
      ) : !record ? (
        <EmptyRail fixtureId={fixtureId} />
      ) : (
        <RailMarket
          record={record}
          now={now}
          connected={!!owner}
          onBet={() => setBetRecord(record)}
        />
      )}

      {record && position && (
        <RailPosition
          record={record}
          position={position}
          programBits={{ program, connection, owner }}
          onDone={reloadAll}
        />
      )}

      <p className="px-1 text-[10px] leading-relaxed text-mist">
        No-loss market: principal is never at risk. Winners split the losing pool&apos;s{" "}
        <span className="text-chalk-dim">yield</span>; losers recover 100% after the lock.
      </p>

      <BetModal
        record={betRecord}
        program={program}
        connection={connection}
        owner={owner}
        onClose={() => setBetRecord(null)}
        onDone={reloadAll}
      />
    </aside>
  );
}

/** Graceful "no market yet" state — the replay still works without a market. */
function EmptyRail({ fixtureId }: { fixtureId: number }) {
  return (
    <div className="panel flex flex-col items-center gap-2 p-6 text-center">
      <svg width="40" height="40" viewBox="0 0 32 32" aria-hidden className="opacity-50">
        <circle cx="16" cy="16" r="12" fill="none" stroke="#78A188" strokeWidth="1.5" strokeDasharray="3 3" />
        <path d="M16 10l4.5 3.2-1.7 5.3h-5.6L11.5 13.2z" fill="none" stroke="#78A188" strokeWidth="1.5" />
      </svg>
      <p className="font-display text-base font-semibold uppercase tracking-wide text-chalk">
        No market yet
      </p>
      <p className="text-xs leading-relaxed text-mist">
        No on-chain market for fixture <span className="led text-chalk-dim">#{fixtureId}</span> yet.
        Markets open automatically ~48h before kickoff once the fixture is on the TxLINE slate.
      </p>
      <Link
        href="/matches"
        className="kit-label mt-2 rounded-xl border border-white/15 px-4 py-2 text-[11px] text-chalk transition hover:border-flood/60 hover:text-flood"
      >
        Browse matches →
      </Link>
    </div>
  );
}

function RailMarket({
  record,
  now,
  connected,
  onBet,
}: {
  record: MarketRecord;
  now: number;
  connected: boolean;
  onBet: () => void;
}) {
  const m = record.account;
  const phase = marketPhase(m, now);
  const winner = sideKey(m.winnerSide);
  const yesShare = poolShare(m.yesPrincipal, m.noPrincipal);
  const pot = prizePot(m);
  const bettingOpen = phase === "betting";

  return (
    <div className="panel flex flex-col gap-3.5 p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display text-lg font-bold uppercase leading-tight tracking-wide text-chalk">
          {m.proposition}
        </h3>
        <StatusBadge phase={phase} winner={winner} />
      </div>

      {/* Yes / No pools — same kit colors as the pitch */}
      <div className="grid grid-cols-2 gap-2">
        <PoolCell side="yes" amount={formatUsdcCompact(m.yesPrincipal)} share={yesShare} win={winner === "yes"} settled={phase === "settled"} />
        <PoolCell side="no" amount={formatUsdcCompact(m.noPrincipal)} share={1 - yesShare} win={winner === "no"} settled={phase === "settled"} />
      </div>
      <PoolBar yesShare={yesShare} />

      <OddsCompare matchId={m.matchId.toNumber()} yesPrincipal={m.yesPrincipal} noPrincipal={m.noPrincipal} />

      <div className="flex items-end justify-between gap-2 border-t border-white/8 pt-3">
        <div>
          <div className="kit-label text-[10px] text-mist">
            {phase === "settled" ? "Winners took" : "Prize pot · yield"}
          </div>
          <div className="led text-lg font-bold text-flood">{formatUsdc(pot)}</div>
        </div>
        <div className="text-right">
          <div className="kit-label text-[10px] text-mist">
            {bettingOpen ? "Betting closes" : "Kickoff"}
          </div>
          <div className="led text-sm font-bold text-chalk">
            <Countdown targetUnix={m.kickoffTs.toNumber()} doneLabel="Kicked off" />
          </div>
        </div>
      </div>

      <Button
        variant="flood"
        size="md"
        disabled={!bettingOpen || !connected}
        onClick={onBet}
        title={!connected ? "Connect a wallet to bet" : undefined}
      >
        {bettingOpen ? (connected ? "Back a side" : "Connect to bet") : "Betting closed"}
      </Button>
    </div>
  );
}

function PoolCell({
  side,
  amount,
  share,
  win,
  settled,
}: {
  side: "yes" | "no";
  amount: string;
  share: number;
  win: boolean;
  settled: boolean;
}) {
  const isYes = side === "yes";
  return (
    <div
      className={clsx(
        "rounded-xl border p-2.5",
        isYes ? "border-yes/25 bg-yes/[0.06]" : "border-no/25 bg-no/[0.06]",
        settled && !win && "opacity-55",
        settled && win && (isYes ? "shadow-[0_0_0_1px_var(--yes)]" : "shadow-[0_0_0_1px_var(--no)]"),
      )}
    >
      <div className={clsx("kit-label flex items-center justify-between text-[10px]", isYes ? "text-yes" : "text-no")}>
        {isYes ? "Yes" : "No"}
        {settled && win && <span title="Winning side">★</span>}
      </div>
      <div className={clsx("led mt-1 text-xl font-bold leading-none", isYes ? "text-yes" : "text-no")}>{amount}</div>
      <div className="led mt-0.5 text-[10px] text-mist">{pct(share)} implied</div>
    </div>
  );
}

/** The connected wallet's position on this market, with the standard claim / withdraw flows. */
function RailPosition({
  record,
  position,
  programBits,
  onDone,
}: {
  record: MarketRecord;
  position: PositionRecord;
  programBits: {
    program: ReturnType<typeof useProgram>["program"];
    connection: ReturnType<typeof useProgram>["connection"];
    owner: PublicKey | undefined;
  };
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const m = record.account;
  const pos = position.account;
  const side = sideKey(pos.side);
  const role = positionRole(m, pos);
  const locked = isLockedLoser(m, pos);
  const alreadyDone =
    (role === "winner" && pos.yieldClaimed && pos.principalWithdrawn) ||
    ((role === "loser" || role === "void") && pos.principalWithdrawn);

  async function run(kind: "claim" | "withdraw") {
    const { program, connection, owner } = programBits;
    if (!owner) return;
    setBusy(true);
    const isClaim = kind === "claim";
    const id = toast.push({
      kind: "pending",
      title: isClaim ? "Claiming winnings…" : "Recovering principal…",
    });
    try {
      const args = { owner, market: record.publicKey, principalMint: m.principalMint };
      const sig = isClaim
        ? await sendClaim(program, connection, args)
        : await sendWithdrawPrincipal(program, connection, args);
      toast.update(id, {
        kind: "success",
        title: isClaim ? "Winnings claimed" : "Principal recovered",
        txSig: sig,
      });
      onDone();
    } catch (e) {
      toast.update(id, {
        kind: "error",
        title: isClaim ? "Claim failed" : "Withdraw failed",
        message: prettifyError(e),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel flex flex-col gap-2.5 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="kit-label text-[10px] text-mist">Your position</span>
        <span className={clsx("kit-label text-[11px]", side === "yes" ? "text-yes" : "text-no")}>
          {side?.toUpperCase()} · <span className="led">{formatUsdc(pos.principal)}</span>{" "}
          {PRINCIPAL_SYMBOL}
        </span>
      </div>

      {role === "pending" && (
        <p className="text-xs text-mist">Awaiting the TxLINE result. Principal is working in the vault.</p>
      )}
      {role === "winner" && !alreadyDone && (
        <div className="flex items-end justify-between rounded-xl border border-yes/25 bg-yes/[0.06] p-2.5">
          <span className="kit-label text-[10px] text-mist">You collect</span>
          <span className="led led-glow text-xl font-bold text-yes">{formatUsdc(claimEstimate(m, pos))}</span>
        </div>
      )}
      {role === "loser" && !alreadyDone && (
        <div className="rounded-xl border border-white/8 bg-pitch-800/60 p-2.5 text-xs text-mist">
          {locked ? (
            <>
              Principal recoverable in{" "}
              <span className="led font-bold text-chalk">
                <Countdown targetUnix={m.loserUnlockTs.toNumber()} doneLabel="Ready" />
              </span>{" "}
              — 100% back, you only forfeited the yield.
            </>
          ) : (
            <>Lock elapsed — recover 100% of your principal.</>
          )}
        </div>
      )}
      {role === "void" && !alreadyDone && (
        <p className="text-xs text-mist">Market voided (one-sided). Refund your principal anytime.</p>
      )}

      {alreadyDone ? (
        <div className="kit-label rounded-lg bg-white/5 py-2 text-center text-[11px] text-mist">
          {role === "winner" ? "Collected ✓" : "Recovered ✓"}
        </div>
      ) : role === "winner" ? (
        <Button variant="flood" size="sm" loading={busy} disabled={!canClaim(m, pos)} onClick={() => run("claim")}>
          Claim winnings
        </Button>
      ) : role === "loser" || role === "void" ? (
        <Button
          variant="outline"
          size="sm"
          loading={busy}
          disabled={!canWithdraw(m, pos)}
          onClick={() => run("withdraw")}
        >
          {canWithdraw(m, pos) ? "Withdraw principal" : "Locked"}
        </Button>
      ) : null}
    </div>
  );
}
