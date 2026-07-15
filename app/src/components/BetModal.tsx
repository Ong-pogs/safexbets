"use client";

import type { Idl, Program } from "@coral-xyz/anchor";
import { BN } from "@coral-xyz/anchor";
import type { Connection, PublicKey } from "@solana/web3.js";
import clsx from "clsx";
import { useMemo, useState } from "react";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useNow } from "@/hooks/useNow";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import { CONFIG, explorerUrl } from "@/lib/config";
import { PRINCIPAL_SYMBOL, USDC_FAUCET_URL } from "@/lib/constants";
import { prettifyError } from "@/lib/errors";
import {
  formatUsdc,
  impliedDecimalOdds,
  pct,
  poolShare,
  proRataYieldShare,
  shortAddr,
  toBaseUnits,
} from "@/lib/format";
import { marketPhase } from "@/lib/market-view";
import { sendPlaceBet } from "@/lib/program";
import { getTxLineForMatch, impliedFromOdds } from "@/lib/txline";
import type { MarketRecord, SideKey } from "@/lib/types";

const QUICK = [5, 25, 100];

/**
 * The betslip. Sportsbook anatomy — selection summary, stake with quick chips, odds, returns —
 * rewritten for a no-loss parimutuel: principal always returns; the prize is a share of the losing
 * pool's *yield*. Balance checks read the market's own `principalMint` (older markets may carry a
 * legacy mint), and a short balance routes to the Circle devnet faucet instead of a dead button.
 */
export function BetModal({
  record,
  program,
  connection,
  owner,
  onClose,
  onDone,
}: {
  record: MarketRecord | null;
  program: Program<Idl>;
  connection: Connection;
  owner: PublicKey | undefined;
  onClose: () => void;
  onDone: () => void;
}) {
  const [side, setSide] = useState<SideKey>("yes");
  const [amount, setAmount] = useState("25");
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const now = useNow();

  // THE market's mint — never the global env mint. Legacy devnet markets predate the Circle
  // USDC switch, and betting there moves *their* token.
  const marketMint = record?.account.principalMint;
  const { amount: balance } = useTokenBalance(connection, owner, marketMint);

  const amountNum = Number(amount);
  const m = record?.account;

  const quote = useMemo(() => {
    if (!m) return null;
    const stake = Number.isFinite(amountNum) && amountNum > 0 ? toBaseUnits(amountNum) : new BN(0);
    const yesAfter = side === "yes" ? m.yesPrincipal.add(stake) : m.yesPrincipal;
    const noAfter = side === "no" ? m.noPrincipal.add(stake) : m.noPrincipal;
    const chosenShare = side === "yes" ? poolShare(yesAfter, noAfter) : poolShare(noAfter, yesAfter);
    const chosenPoolAfter = side === "yes" ? yesAfter : noAfter;
    const opposingYield = side === "yes" ? m.noYield : m.yesYield;
    const opposingPool = side === "yes" ? m.noPrincipal : m.yesPrincipal;
    // Your cut of the losing pool's yield if your side wins — at today's pot (it grows with time).
    const prizeNow = proRataYieldShare(opposingYield, stake, chosenPoolAfter);
    return { stake, chosenShare, prizeNow, opposingPool, oneSided: opposingPool.isZero() };
  }, [m, side, amountNum]);

  if (!record || !m || !quote) return null;

  const matchId = m.matchId.toNumber();
  const txline = getTxLineForMatch(matchId);
  const txImplied = txline ? impliedFromOdds(txline.odds) : null;

  const isAppMint = m.principalMint.toBase58() === CONFIG.principalMint;
  const tokenLabel = isAppMint ? PRINCIPAL_SYMBOL : `legacy ${shortAddr(m.principalMint.toBase58())}`;

  const phase = marketPhase(m, now);
  const bettingOpen = phase === "betting";
  const overBalance = balance != null && amountNum > balance;
  const hasStake = Number.isFinite(amountNum) && amountNum > 0;
  const valid = hasStake && !overBalance && !!owner && bettingOpen;

  const ctaReason = !owner
    ? "Connect a wallet to bet"
    : !bettingOpen
      ? "Betting closed at kickoff"
      : !hasStake
        ? "Enter a stake"
        : overBalance
          ? `Insufficient ${isAppMint ? PRINCIPAL_SYMBOL : "balance"}`
          : null;

  async function submit() {
    if (!valid || !owner || !record) return;
    setBusy(true);
    const id = toast.push({
      kind: "pending",
      title: `Backing ${side.toUpperCase()}…`,
      message: `${amountNum} ${PRINCIPAL_SYMBOL} on "${record.account.proposition}"`,
    });
    try {
      const sig = await sendPlaceBet(program, connection, {
        bettor: owner,
        market: record.publicKey,
        side,
        amount: toBaseUnits(amountNum),
        principalMint: record.account.principalMint,
      });
      toast.update(id, {
        kind: "success",
        title: "Bet placed — principal safe",
        message: `${amountNum} ${PRINCIPAL_SYMBOL} on ${side.toUpperCase()}`,
        txSig: sig,
      });
      onDone();
      onClose();
    } catch (e) {
      toast.update(id, { kind: "error", title: "Bet failed", message: prettifyError(e) });
    } finally {
      setBusy(false);
    }
  }

  const yesShare = poolShare(m.yesPrincipal, m.noPrincipal);

  return (
    <Modal
      open
      onClose={onClose}
      title="Betslip"
      subtitle={txline ? `${txline.home} vs ${txline.away} · match #${matchId}` : `Match #${matchId}`}
    >
      <div className="flex flex-col gap-4">
        {/* selection summary */}
        <div>
          <div className="kit-label mb-1.5 text-[10px] text-mist">Your selection</div>
          <div className="font-display text-lg font-bold uppercase leading-tight tracking-wide text-chalk">
            {m.proposition}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <SidePick side="yes" active={side === "yes"} share={yesShare} onClick={() => setSide("yes")} />
            <SidePick side="no" active={side === "no"} share={1 - yesShare} onClick={() => setSide("no")} />
          </div>
        </div>

        {/* odds: pool-implied (the real price) beside the TxLINE reference line */}
        <div className="grid grid-cols-2 gap-2">
          <OddsBox
            label="Pool odds"
            tag="after your stake"
            decimal={impliedDecimalOdds(quote.chosenShare)}
            prob={quote.chosenShare}
            emphasized
          />
          <OddsBox
            label="TxLINE line"
            tag="reference"
            decimal={txline ? txline.odds[side] : null}
            prob={txImplied ? txImplied[side] : null}
          />
        </div>

        {/* stake */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="bet-amount" className="kit-label text-[10px] text-mist">
              Stake ({PRINCIPAL_SYMBOL})
            </label>
            <span className="led text-[11px] text-mist">
              Balance:{" "}
              <span className={overBalance ? "text-alert" : "text-chalk-dim"}>
                {balance == null
                  ? "—"
                  : balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>{" "}
              {tokenLabel}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="bet-amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              className={clsx(
                "led w-full rounded-xl border bg-pitch-800 px-4 py-3 text-2xl font-bold text-chalk outline-none transition",
                overBalance ? "border-alert/60" : "border-white/10 focus:border-flood/60",
              )}
              placeholder="0"
              aria-invalid={overBalance || undefined}
              aria-describedby={overBalance ? "bet-balance-warning" : undefined}
            />
            <button
              type="button"
              onClick={() => balance != null && setAmount(String(balance))}
              disabled={balance == null || balance <= 0}
              className="kit-label shrink-0 rounded-lg border border-white/10 px-3 py-3 text-[11px] text-mist transition hover:border-flood/50 hover:text-flood disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-white/10 disabled:hover:text-mist"
            >
              Max
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {QUICK.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setAmount(String(q))}
                className={clsx(
                  "led rounded-lg border px-3 py-1 text-xs transition",
                  amount === String(q)
                    ? "border-flood/60 text-flood"
                    : "border-white/10 text-chalk-dim hover:border-flood/50 hover:text-flood",
                )}
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* insufficient balance — say which token, how short, and where to top up */}
        {overBalance && (
          <div
            id="bet-balance-warning"
            className="rounded-xl border border-alert/25 bg-alert/[0.06] p-3 text-xs leading-relaxed text-chalk-dim"
          >
            <p>
              <span className="font-semibold text-alert">
                You&apos;re {(amountNum - (balance ?? 0)).toLocaleString(undefined, { maximumFractionDigits: 2 })}{" "}
                {isAppMint ? PRINCIPAL_SYMBOL : "short"}
              </span>{" "}
              — this market stakes{" "}
              {isAppMint ? (
                <>
                  devnet {PRINCIPAL_SYMBOL} ({shortAddr(m.principalMint.toBase58())})
                </>
              ) : (
                <a
                  href={explorerUrl("address", m.principalMint.toBase58())}
                  target="_blank"
                  rel="noreferrer"
                  className="led underline underline-offset-2 hover:text-flood"
                >
                  {shortAddr(m.principalMint.toBase58())}
                </a>
              )}
              , and you hold{" "}
              {balance == null ? "—" : balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}.
            </p>
            {isAppMint ? (
              <a
                href={USDC_FAUCET_URL}
                target="_blank"
                rel="noreferrer"
                className="kit-label mt-2 inline-flex items-center gap-1.5 rounded-lg bg-flood px-3 py-1.5 text-[10px] text-pitch-900 transition hover:shadow-[0_8px_20px_-8px_rgba(203,255,62,0.6)]"
              >
                Get devnet USDC — faucet.circle.com ↗
              </a>
            ) : (
              <p className="mt-1.5 text-[11px] text-mist">
                A legacy demo market from before the Circle USDC switch — your {PRINCIPAL_SYMBOL} balance
                doesn&apos;t apply here.
              </p>
            )}
          </div>
        )}

        {/* returns — the no-loss promise, itemized */}
        <div className="rounded-xl border border-white/8 bg-pitch-800/60 p-3.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-mist">Principal back</span>
            <span className="led font-bold text-chalk">
              Always · {formatUsdc(quote.stake)} {PRINCIPAL_SYMBOL}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3 text-sm">
            <span className="text-mist">Potential prize</span>
            <span className="led text-right font-bold text-flood">
              {quote.prizeNow.isZero() ? (
                <span className="text-[11px] font-normal normal-case text-chalk-dim">
                  share of the losing pool&apos;s yield
                </span>
              ) : (
                <>≈ {formatUsdc(quote.prizeNow)} at today&apos;s pot</>
              )}
            </span>
          </div>
          <div className="chalk-hr my-2.5" />
          <p className="text-[11px] leading-relaxed text-mist">
            Win: principal + a pro-rata cut of the losing pool&apos;s <span className="text-chalk-dim">yield</span>.
            Lose: principal locks for the lock window, then 100% back.
            {quote.oneSided && hasStake && (
              <> If nobody backs the other side, the market voids and everyone is refunded in full.</>
            )}
          </p>
        </div>

        <Button
          variant={side === "yes" ? "yes" : "no"}
          size="lg"
          loading={busy}
          disabled={!valid}
          onClick={submit}
        >
          {busy
            ? "Confirming…"
            : ctaReason ?? `Back ${side.toUpperCase()} · ${amount || 0} ${PRINCIPAL_SYMBOL}`}
        </Button>
      </div>
    </Modal>
  );
}

function SidePick({
  side,
  active,
  share,
  onClick,
}: {
  side: SideKey;
  active: boolean;
  share: number;
  onClick: () => void;
}) {
  const isYes = side === "yes";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        "rounded-2xl border p-4 text-left transition-all",
        isYes ? "hover:border-yes/60" : "hover:border-no/60",
        active
          ? isYes
            ? "border-yes bg-yes/10 shadow-[0_0_24px_-8px_var(--yes)]"
            : "border-no bg-no/10 shadow-[0_0_24px_-8px_var(--no)]"
          : "border-white/10 bg-white/[0.02]",
      )}
    >
      <div className={clsx("kit-label text-lg", isYes ? "text-yes" : "text-no")}>
        {isYes ? "Yes" : "No"}
      </div>
      <div className="led mt-1 text-xs text-mist">{pct(share)} implied</div>
    </button>
  );
}

function OddsBox({
  label,
  tag,
  decimal,
  prob,
  emphasized,
}: {
  label: string;
  tag: string;
  decimal: number | null;
  prob: number | null;
  emphasized?: boolean;
}) {
  return (
    <div
      className={clsx(
        "rounded-xl border p-2.5",
        emphasized ? "border-flood/25 bg-flood/[0.05]" : "border-white/8 bg-pitch-800/60",
      )}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="kit-label text-[9px] text-mist">{label}</span>
        <span className="text-[8px] font-semibold uppercase tracking-wider text-mist/80">{tag}</span>
      </div>
      <div className={clsx("led mt-1 text-xl font-bold leading-none", emphasized ? "text-flood" : "text-chalk")}>
        {decimal != null && decimal > 0 ? decimal.toFixed(2) : "—"}
      </div>
      <div className="led mt-0.5 text-[10px] text-mist">{prob != null ? `${pct(prob)} implied` : "no line"}</div>
    </div>
  );
}
