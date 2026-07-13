"use client";

import { BN, type Idl, type Program } from "@coral-xyz/anchor";
import type { Connection, PublicKey } from "@solana/web3.js";
import { useMemo, useState } from "react";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/Button";
import { PRINCIPAL_SYMBOL } from "@/lib/constants";
import { prettifyError } from "@/lib/errors";
import { formatUsdc, toBaseUnits, toUiAmount } from "@/lib/format";
import { marketPhase, prizePot } from "@/lib/market-view";
import { sendAccrue, sendInitializeMarket, sendSettle } from "@/lib/program";
import { getTxLineFeed, getTxLineForMatch } from "@/lib/txline";
import { type MarketRecord, sideKey } from "@/lib/types";
import { useNow } from "@/hooks/useNow";
import { Countdown } from "./Countdown";

/**
 * Each "Advance 7 days" press stacks a demo-accelerated week of yield onto the losing pool.
 * (Real MockYield at ~8% APY is ≈0.15%/week — invisible on stage — so the demo compresses a week
 * into a punchy 10% of the losing principal. Clearly labelled as simulated.)
 */
const DEMO_WEEK_RATE = 0.1;

const LOCK_PRESETS = [
  { label: "7 days (real)", value: 0 }, // 0 → program uses the 7-day default
  { label: "5 min (fast test)", value: 300 },
  { label: "1 hour", value: 3600 },
];

export function DemoControls({
  markets,
  program,
  connection,
  owner,
  principalMint,
  onDone,
}: {
  markets: MarketRecord[];
  program: Program<Idl>;
  connection: Connection;
  owner: PublicKey | undefined;
  principalMint: PublicKey | null;
  onDone: () => void;
}) {
  if (!owner) return null;

  const myMarkets = markets.filter((r) => r.account.authority.equals(owner));

  return (
    <section className="panel overflow-hidden">
      <div className="flex items-center gap-3 border-b border-white/8 bg-flood/[0.04] px-5 py-4">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-flood/15 text-flood">▦</span>
        <div>
          <h2 className="font-display text-xl font-bold uppercase tracking-wide text-chalk">
            Match Control
          </h2>
          <p className="text-xs text-mist">
            Operator booth — you author markets, post the TxLINE result, and stack the yield prize.
          </p>
        </div>
      </div>

      <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <CreateMarketForm
          program={program}
          owner={owner}
          principalMint={principalMint}
          onDone={onDone}
        />

        <div>
          <div className="kit-label mb-2 text-[11px] text-mist">Your markets ({myMarkets.length})</div>
          {myMarkets.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-xs text-mist">
              No markets yet. Create one on the left — you become its authority and can settle it.
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {myMarkets.map((r) => (
                <OperatorMarketRow
                  key={r.publicKey.toBase58()}
                  record={r}
                  program={program}
                  connection={connection}
                  owner={owner}
                  onDone={onDone}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function CreateMarketForm({
  program,
  owner,
  principalMint,
  onDone,
}: {
  program: Program<Idl>;
  owner: PublicKey;
  principalMint: PublicKey | null;
  onDone: () => void;
}) {
  const feed = useMemo(() => getTxLineFeed(), []);
  const [fixtureId, setFixtureId] = useState<string>(feed[0] ? String(feed[0].matchId) : "custom");
  const [proposition, setProposition] = useState<string>(feed[0]?.proposition ?? "Home to win?");
  const [kickoffMin, setKickoffMin] = useState("2");
  const [lock, setLock] = useState("0");
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const isCustom = fixtureId === "custom";
  const selectedFixture = isCustom ? undefined : getTxLineForMatch(Number(fixtureId));

  function onSelectFixture(value: string) {
    setFixtureId(value);
    if (value !== "custom") {
      const f = getTxLineForMatch(Number(value));
      if (f) setProposition(f.proposition);
    }
  }

  async function create() {
    if (!principalMint) return;
    setBusy(true);
    // Reuse the fixture's id as the on-chain match_id so the market links back to its TxLINE line.
    // Custom markets get a unique, monotonically-increasing id (no fixture odds).
    const matchId = isCustom ? new BN(Date.now()) : new BN(fixtureId);
    const kickoffTs = new BN(Math.floor(Date.now() / 1000) + Math.round(Number(kickoffMin) * 60));
    const lockPeriod = new BN(Number(lock));

    const id = toast.push({ kind: "pending", title: "Creating market…", message: proposition });
    try {
      const sig = await sendInitializeMarket(program, {
        authority: owner,
        matchId,
        proposition: proposition.slice(0, 64),
        kickoffTs,
        lockPeriod,
        principalMint,
      });
      toast.update(id, { kind: "success", title: "Market created", message: proposition, txSig: sig });
      onDone();
    } catch (e) {
      toast.update(id, { kind: "error", title: "Create failed", message: prettifyError(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-white/8 bg-pitch-800/50 p-4">
      <div className="kit-label text-[11px] text-flood">Create demo market</div>

      <Field label="Fixture (TxLINE)">
        <select
          value={fixtureId}
          onChange={(e) => onSelectFixture(e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-pitch-700 px-3 py-2 text-sm text-chalk outline-none focus:border-flood/60"
        >
          {feed.map((f) => (
            <option key={f.matchId} value={f.matchId}>
              {f.home} vs {f.away}
            </option>
          ))}
          <option value="custom">Custom (no line)</option>
        </select>
      </Field>

      <Field label="Proposition">
        <input
          value={proposition}
          maxLength={64}
          onChange={(e) => setProposition(e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-pitch-700 px-3 py-2 text-sm text-chalk outline-none focus:border-flood/60"
          placeholder="Home to win?"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Kickoff (min from now)">
          <input
            inputMode="numeric"
            value={kickoffMin}
            onChange={(e) => setKickoffMin(e.target.value.replace(/[^0-9.]/g, ""))}
            className="led w-full rounded-lg border border-white/10 bg-pitch-700 px-3 py-2 text-sm text-chalk outline-none focus:border-flood/60"
          />
        </Field>
        <Field label="Loser lock">
          <select
            value={lock}
            onChange={(e) => setLock(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-pitch-700 px-3 py-2 text-sm text-chalk outline-none focus:border-flood/60"
          >
            {LOCK_PRESETS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {selectedFixture && (
        <p className="text-[11px] text-mist">
          TxLINE line: <span className="led text-yes">{selectedFixture.odds.yes.toFixed(2)}</span> /{" "}
          <span className="led text-no">{selectedFixture.odds.no.toFixed(2)}</span>
        </p>
      )}

      {!principalMint && (
        <p className="text-[11px] text-alert">
          Set NEXT_PUBLIC_PRINCIPAL_MINT to create markets (the mock-USDC mint).
        </p>
      )}

      <Button variant="flood" loading={busy} disabled={!principalMint} onClick={create}>
        Create market
      </Button>
    </div>
  );
}

function OperatorMarketRow({
  record,
  program,
  connection,
  owner,
  onDone,
}: {
  record: MarketRecord;
  program: Program<Idl>;
  connection: Connection;
  owner: PublicKey;
  onDone: () => void;
}) {
  const now = useNow();
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();

  const m = record.account;
  const phase = marketPhase(m, now);
  const winner = sideKey(m.winnerSide);
  const kickoff = m.kickoffTs.toNumber();
  const canSettle = now >= kickoff && (phase === "betting" || phase === "in_play");
  const isSettled = phase === "settled";

  // After settle, "Advance" stacks yield onto the loser so all of it becomes claimable prize.
  const loserSide = winner ? (winner === "yes" ? "no" : "yes") : null;
  const loserPrincipal = loserSide === "yes" ? m.yesPrincipal : loserSide === "no" ? m.noPrincipal : new BN(0);
  const advanceUi = Math.max(1, toUiAmount(loserPrincipal) * DEMO_WEEK_RATE);
  const canAdvance = isSettled && !!loserSide && !loserPrincipal.isZero();

  async function runSettle(outcome: "yes" | "no") {
    setBusy(`settle-${outcome}`);
    const id = toast.push({ kind: "pending", title: `Settling ${outcome.toUpperCase()}…` });
    try {
      const sig = await sendSettle(program, { authority: owner, market: record.publicKey, outcome });
      toast.update(id, {
        kind: "success",
        title: `Settled ${outcome.toUpperCase()}`,
        message: "TxLINE result posted on-chain",
        txSig: sig,
      });
      onDone();
    } catch (e) {
      toast.update(id, { kind: "error", title: "Settle failed", message: prettifyError(e) });
    } finally {
      setBusy(null);
    }
  }

  async function runAdvance() {
    if (!loserSide) return;
    setBusy("advance");
    const id = toast.push({
      kind: "pending",
      title: "Advancing 7 days…",
      message: `+${advanceUi.toFixed(2)} ${PRINCIPAL_SYMBOL} yield to the ${loserSide.toUpperCase()} pool`,
    });
    try {
      const sig = await sendAccrue(program, connection, {
        authority: owner,
        market: record.publicKey,
        side: loserSide,
        amount: toBaseUnits(advanceUi),
        principalMint: m.principalMint,
      });
      toast.update(id, {
        kind: "success",
        title: "Yield stacked",
        message: `Prize pot now ${formatUsdc(prizePot(m).add(toBaseUnits(advanceUi)))} ${PRINCIPAL_SYMBOL}`,
        txSig: sig,
      });
      onDone();
    } catch (e) {
      toast.update(id, { kind: "error", title: "Accrue failed", message: prettifyError(e) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-xl border border-white/8 bg-pitch-700/60 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="truncate text-sm font-semibold text-chalk">{m.proposition}</span>
        <span className="led shrink-0 text-[11px] text-mist">
          pot {formatUsdc(prizePot(m))}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {!isSettled ? (
          canSettle ? (
            <>
              <Button size="sm" variant="yes" loading={busy === "settle-yes"} onClick={() => runSettle("yes")}>
                Settle Yes
              </Button>
              <Button size="sm" variant="no" loading={busy === "settle-no"} onClick={() => runSettle("no")}>
                Settle No
              </Button>
            </>
          ) : (
            <span className="led text-xs text-mist">
              Kick off in <Countdown targetUnix={kickoff} doneLabel="now" /> — settle unlocks then
            </span>
          )
        ) : (
          <span className="kit-label rounded bg-white/5 px-2 py-1 text-[10px] text-chalk">
            {winner ? `${winner.toUpperCase()} won` : "Void"}
          </span>
        )}

        {canAdvance && (
          <Button size="sm" variant="flood" loading={busy === "advance"} onClick={runAdvance}>
            Advance 7 days · +{advanceUi.toFixed(2)}
          </Button>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="kit-label mb-1 block text-[10px] text-mist">{label}</span>
      {children}
    </label>
  );
}
