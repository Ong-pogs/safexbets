"use client";

import { BN } from "@coral-xyz/anchor";
import type { Idl, Program } from "@coral-xyz/anchor";
import type { Connection, PublicKey } from "@solana/web3.js";
import clsx from "clsx";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Countdown } from "@/components/Countdown";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/Button";
import { useMarkets } from "@/hooks/useMarkets";
import { usePositions } from "@/hooks/usePositions";
import { useProgram } from "@/hooks/useProgram";
import { PRINCIPAL_SYMBOL } from "@/lib/constants";
import { prettifyError } from "@/lib/errors";
import { formatUsdc } from "@/lib/format";
import {
  bonusEstimate,
  canClaim,
  canWithdraw,
  claimEstimate,
  positionState,
  type PositionState,
} from "@/lib/market-view";
import { sendClaim, sendWithdrawPrincipal } from "@/lib/program";
import { getTxLineForMatch } from "@/lib/txline";
import { type MarketRecord, type PositionRecord, sideKey } from "@/lib/types";

/**
 * My Bets — the sportsbook bet-tracker, no-loss edition. Open / Settled tabs, betslip state chips
 * (a "lost" bet here is just Locked with a countdown to 100% principal recovery), aggregates, and
 * the on-chain claim / withdraw actions. Each row links to its fixture's Match Center.
 */

type Row = { position: PositionRecord; market: MarketRecord; state: PositionState };
type Tab = "open" | "settled";

const CHIP: Record<PositionState, { label: React.ReactNode; cls: string; live?: boolean }> = {
  open: { label: "Open", cls: "text-flood border-flood/30 bg-flood/10", live: true },
  claimable: { label: <>Claimable 💰</>, cls: "text-yes border-yes/30 bg-yes/10", live: true },
  locked: { label: <>Locked ⏳</>, cls: "text-no border-no/30 bg-no/10" },
  recoverable: { label: <>Recoverable ↩</>, cls: "text-chalk border-white/25 bg-white/5" },
  collected: { label: <>Collected ✓</>, cls: "text-mist border-white/15 bg-white/5" },
  recovered: { label: <>Recovered ✓</>, cls: "text-mist border-white/15 bg-white/5" },
  void: { label: <>Void ↩</>, cls: "text-mist border-white/15 bg-white/5" },
};

export function MyBets() {
  const { program, connection, wallet } = useProgram();
  const owner = wallet?.publicKey;

  const { markets, loading: marketsLoading, reload: reloadMarkets } = useMarkets(program);
  const { positions, loading, reload: reloadPositions } = usePositions(program, owner);
  const [tab, setTab] = useState<Tab>("open");

  const rows = useMemo<Row[]>(() => {
    const byKey = new Map(markets.map((m) => [m.publicKey.toBase58(), m]));
    return positions
      .map((p) => {
        const market = byKey.get(p.account.market.toBase58());
        return market ? { position: p, market, state: positionState(market.account, p.account) } : null;
      })
      .filter((r): r is Row => r !== null)
      .sort((a, b) => b.market.account.kickoffTs.cmp(a.market.account.kickoffTs));
  }, [positions, markets]);

  const openRows = rows.filter((r) => r.state === "open");
  const settledRows = rows.filter((r) => r.state !== "open");
  const shown = tab === "open" ? openRows : settledRows;

  const totals = useMemo(() => aggregate(rows), [rows]);

  const reloadAll = () => {
    void reloadMarkets();
    void reloadPositions();
  };

  if (!owner) {
    return (
      <div className="panel flex flex-col items-center gap-3 p-10 text-center sm:p-14">
        <TicketGhost />
        <p className="font-display text-xl uppercase tracking-wide text-chalk">Your betslips live here</p>
        <p className="max-w-md text-sm leading-relaxed text-mist">
          Connect a devnet wallet to track open calls, claim winnings, and recover locked principal.
          Nothing you stake is ever lost — only its yield is at play.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* aggregate strip */}
      <div className="panel grid grid-cols-1 divide-y divide-white/8 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <Aggregate label="In play" value={formatUsdc(totals.inPlay)} hint="staked on unsettled markets" />
        <Aggregate
          label="Claimable now"
          value={formatUsdc(totals.claimable)}
          hint="winnings + unlocked principal"
          accent={!totals.claimable.isZero()}
        />
        <Aggregate
          label="Locked"
          value={formatUsdc(totals.locked)}
          hint={
            totals.nextUnlockTs ? (
              <>
                next unlock in <Countdown targetUnix={totals.nextUnlockTs} doneLabel="now" />
              </>
            ) : (
              "loser principal in its 7-day lock"
            )
          }
        />
      </div>

      {/* tabs */}
      <div
        role="tablist"
        aria-label="Bet status"
        className="flex w-fit items-center gap-1 rounded-xl border border-white/10 bg-pitch-800/60 p-1"
      >
        <TabButton active={tab === "open"} onClick={() => setTab("open")} count={openRows.length}>
          Open
        </TabButton>
        <TabButton active={tab === "settled"} onClick={() => setTab("settled")} count={settledRows.length}>
          Settled
        </TabButton>
      </div>

      {(loading || marketsLoading) && rows.length === 0 ? (
        <div className="grid gap-3 sm:grid-cols-2" aria-busy="true" aria-label="Loading your bets">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="panel h-44 animate-pulse opacity-60" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <div className="panel flex flex-col items-center gap-2 p-10 text-center">
          <p className="font-display text-lg uppercase tracking-wide text-chalk">
            {tab === "open" ? "No open bets" : "Nothing settled yet"}
          </p>
          <p className="max-w-sm text-sm text-mist">
            {tab === "open"
              ? "Back a call from the matches lobby — your principal is always recoverable."
              : "Once TxLINE posts a result on-chain, your settled betslips land here."}
          </p>
          {tab === "open" && (
            <Link
              href="/matches"
              className="kit-label mt-2 rounded-xl bg-flood px-4 py-2.5 text-[11px] text-pitch-900 transition hover:shadow-[0_10px_26px_-10px_rgba(203,255,62,0.6)]"
            >
              Browse matches →
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {shown.map((row) => (
            <BetCard
              key={row.position.publicKey.toBase58()}
              row={row}
              program={program}
              connection={connection}
              owner={owner}
              onDone={reloadAll}
            />
          ))}
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------

function aggregate(rows: Row[]) {
  let inPlay = new BN(0);
  let claimable = new BN(0);
  let locked = new BN(0);
  let nextUnlockTs: number | null = null;

  for (const { position, market, state } of rows) {
    const pos = position.account;
    const m = market.account;
    if (state === "open") inPlay = inPlay.add(pos.principal);
    if (state === "claimable") claimable = claimable.add(claimEstimate(m, pos));
    if (state === "recoverable" || state === "void") claimable = claimable.add(pos.principal);
    if (state === "locked") {
      locked = locked.add(pos.principal);
      const unlock = m.loserUnlockTs.toNumber();
      if (nextUnlockTs === null || unlock < nextUnlockTs) nextUnlockTs = unlock;
    }
  }
  return { inPlay, claimable, locked, nextUnlockTs };
}

function Aggregate({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="px-5 py-4">
      <div className="kit-label text-[10px] text-mist">{label}</div>
      <div className={clsx("led mt-1 text-2xl font-bold leading-none", accent ? "led-glow text-yes" : "text-chalk")}>
        {value}
        <span className="ml-1.5 text-xs font-normal text-mist">{PRINCIPAL_SYMBOL}</span>
      </div>
      <div className="led mt-1 text-[10px] text-mist">{hint}</div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={clsx(
        "kit-label flex items-center gap-2 rounded-lg px-4 py-2 text-[11px] transition",
        active ? "bg-flood/15 text-flood" : "text-mist hover:text-chalk",
      )}
    >
      {children}
      <span className={clsx("led rounded-full px-1.5 py-0.5 text-[10px]", active ? "bg-flood/15" : "bg-white/5")}>
        {count}
      </span>
    </button>
  );
}

function BetCard({
  row,
  program,
  connection,
  owner,
  onDone,
}: {
  row: Row;
  program: Program<Idl>;
  connection: Connection;
  owner: PublicKey;
  onDone: () => void;
}) {
  const { position, market, state } = row;
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const m = market.account;
  const pos = position.account;
  const side = sideKey(pos.side);
  const matchId = m.matchId.toNumber();
  const txline = getTxLineForMatch(matchId);
  const chip = CHIP[state];

  async function run(kind: "claim" | "withdraw") {
    setBusy(true);
    const isClaim = kind === "claim";
    const id = toast.push({
      kind: "pending",
      title: isClaim ? "Claiming winnings…" : "Recovering principal…",
    });
    try {
      // Always the market's own mint — legacy markets may predate the current env mint.
      const args = { owner, market: market.publicKey, principalMint: m.principalMint };
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
    <div className="panel flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {txline && (
            <div className="kit-label mb-0.5 truncate text-[10px] text-mist">
              {txline.home} vs {txline.away}
            </div>
          )}
          <Link
            href={`/match/${matchId}`}
            className="group/link block truncate font-display text-base font-semibold uppercase tracking-wide text-chalk transition hover:text-flood"
            title="Open this fixture's Match Center"
          >
            {m.proposition}
            <span className="ml-1.5 text-[11px] opacity-0 transition group-hover/link:opacity-100" aria-hidden>
              →
            </span>
          </Link>
          <div className="mt-1 flex items-center gap-2 text-xs">
            <span className={clsx("kit-label", side === "yes" ? "text-yes" : "text-no")}>
              {side?.toUpperCase()}
            </span>
            <span className="text-mist">·</span>
            <span className="led text-mist">
              {formatUsdc(pos.principal)} {PRINCIPAL_SYMBOL} staked
            </span>
          </div>
        </div>

        <span
          className={clsx(
            "kit-label inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px]",
            chip.cls,
          )}
        >
          {chip.live && <span className="h-1.5 w-1.5 animate-live-pulse rounded-full bg-current" aria-hidden />}
          {chip.label}
          {state === "locked" && (
            <span className="led normal-case tracking-normal">
              <Countdown targetUnix={m.loserUnlockTs.toNumber()} doneLabel="now" />
            </span>
          )}
        </span>
      </div>

      {/* state body */}
      {state === "open" && (
        <p className="text-xs leading-relaxed text-mist">
          Awaiting the TxLINE result. Principal is working in the vault — win and you take the losing
          pool&apos;s yield on top.
        </p>
      )}

      {state === "claimable" && (
        <div className="rounded-xl border border-yes/25 bg-yes/[0.06] p-3">
          <div className="flex items-end justify-between">
            <div>
              <div className="kit-label text-[10px] text-mist">You collect</div>
              <div className="led led-glow text-2xl font-bold text-yes">
                {formatUsdc(claimEstimate(m, pos))}
              </div>
            </div>
            <div className="text-right">
              <div className="kit-label text-[10px] text-mist">of which prize</div>
              <div className="led text-sm font-bold text-flood">+{formatUsdc(bonusEstimate(m, pos))}</div>
            </div>
          </div>
        </div>
      )}

      {state === "locked" && (
        <div className="rounded-xl border border-white/8 bg-pitch-800/60 p-3">
          <div className="kit-label text-[10px] text-mist">Principal recoverable in</div>
          <div className="led text-2xl font-bold text-chalk">
            <Countdown targetUnix={m.loserUnlockTs.toNumber()} doneLabel="Ready" />
          </div>
          <div className="mt-1 text-[11px] text-mist">
            100% back — you only forfeited this week&apos;s yield.
          </div>
        </div>
      )}

      {state === "recoverable" && (
        <p className="text-xs text-mist">Lock elapsed — recover 100% of your principal below.</p>
      )}
      {state === "void" && (
        <p className="text-xs text-mist">Market voided (one-sided). Refund your full principal anytime.</p>
      )}

      {/* action */}
      {state === "claimable" ? (
        <Button variant="flood" loading={busy} disabled={!canClaim(m, pos)} onClick={() => run("claim")}>
          Claim winnings
        </Button>
      ) : state === "recoverable" || state === "void" ? (
        <Button variant="outline" loading={busy} disabled={!canWithdraw(m, pos)} onClick={() => run("withdraw")}>
          Withdraw principal
        </Button>
      ) : state === "locked" ? (
        <Button variant="outline" disabled>
          Locked until the countdown ends
        </Button>
      ) : state === "collected" || state === "recovered" ? (
        <div className="kit-label rounded-lg bg-white/5 py-2 text-center text-[11px] text-mist">
          {state === "collected" ? "Collected ✓" : "Recovered ✓"}
        </div>
      ) : null}
    </div>
  );
}

function TicketGhost() {
  return (
    <svg width="52" height="52" viewBox="0 0 22 22" fill="none" stroke="#78A188" strokeWidth="1" aria-hidden className="opacity-70">
      <path
        d="M3 7.5A1.5 1.5 0 0 1 4.5 6h13A1.5 1.5 0 0 1 19 7.5v1.8a1.7 1.7 0 0 0 0 3.4v1.8a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 3 14.5v-1.8a1.7 1.7 0 0 0 0-3.4z"
        strokeDasharray="2.5 2"
      />
      <path d="M8 9.5l2 2 4-3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
