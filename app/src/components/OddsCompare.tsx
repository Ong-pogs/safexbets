"use client";

import { BN } from "@coral-xyz/anchor";
import { impliedDecimalOdds, pct, poolShare } from "@/lib/format";
import { getTxLineForMatch, impliedFromOdds } from "@/lib/txline";

/**
 * Side-by-side odds: the TxLINE (fixture) bookmaker line vs the market's own parimutuel
 * pool-implied odds. The fixture is looked up by the market's on-chain matchId.
 */
export function OddsCompare({
  matchId,
  yesPrincipal,
  noPrincipal,
}: {
  matchId: number;
  yesPrincipal: BN;
  noPrincipal: BN;
}) {
  const txline = getTxLineForMatch(matchId);
  const txImplied = txline ? impliedFromOdds(txline.odds) : null;

  const yesShare = poolShare(yesPrincipal, noPrincipal);
  const noShare = 1 - yesShare;

  return (
    <div className="rounded-xl border border-white/8 bg-pitch-800/60 p-3">
      <div className="grid grid-cols-[auto_1fr_1fr] items-center gap-x-3 gap-y-2 text-sm">
        {/* header row */}
        <div />
        <div className="kit-label text-center text-[10px] text-yes">Yes</div>
        <div className="kit-label text-center text-[10px] text-no">No</div>

        {/* TxLINE fixture row */}
        <div className="flex items-center gap-1.5">
          <span className="kit-label text-[10px] text-mist">TxLINE</span>
          <span className="rounded bg-flood/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-flood">
            fixture
          </span>
        </div>
        {txline && txImplied ? (
          <>
            <OddsCell decimal={txline.odds.yes} prob={txImplied.yes} tone="yes" />
            <OddsCell decimal={txline.odds.no} prob={txImplied.no} tone="no" />
          </>
        ) : (
          <div className="col-span-2 text-center text-xs text-mist">no line for this match</div>
        )}

        {/* Pool-implied row */}
        <div className="kit-label text-[10px] text-mist">Pool</div>
        <OddsCell decimal={impliedDecimalOdds(yesShare)} prob={yesShare} tone="yes" muted />
        <OddsCell decimal={impliedDecimalOdds(noShare)} prob={noShare} tone="no" muted />
      </div>
    </div>
  );
}

function OddsCell({
  decimal,
  prob,
  tone,
  muted,
}: {
  decimal: number;
  prob: number;
  tone: "yes" | "no";
  muted?: boolean;
}) {
  const color = tone === "yes" ? "text-yes" : "text-no";
  return (
    <div className="text-center">
      <div className={`led text-base font-bold ${muted ? "text-chalk" : color}`}>
        {decimal > 0 ? decimal.toFixed(2) : "—"}
      </div>
      <div className="led text-[11px] text-mist">{pct(prob)}</div>
    </div>
  );
}
