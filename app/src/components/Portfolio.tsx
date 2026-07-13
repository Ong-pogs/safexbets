"use client";

import type { Idl, Program } from "@coral-xyz/anchor";
import type { Connection, PublicKey } from "@solana/web3.js";
import clsx from "clsx";
import { useMemo, useState } from "react";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/Button";
import { PRINCIPAL_SYMBOL } from "@/lib/constants";
import { prettifyError } from "@/lib/errors";
import { formatUsdc } from "@/lib/format";
import {
  bonusEstimate,
  canClaim,
  canWithdraw,
  claimEstimate,
  isLockedLoser,
  positionRole,
} from "@/lib/market-view";
import { sendClaim, sendWithdrawPrincipal } from "@/lib/program";
import { type MarketRecord, type PositionRecord, sideKey } from "@/lib/types";
import { Countdown } from "./Countdown";

export function Portfolio({
  positions,
  markets,
  program,
  connection,
  owner,
  onDone,
}: {
  positions: PositionRecord[];
  markets: MarketRecord[];
  program: Program<Idl>;
  connection: Connection;
  owner: PublicKey | undefined;
  onDone: () => void;
}) {
  const marketByKey = useMemo(() => {
    const map = new Map<string, MarketRecord>();
    for (const m of markets) map.set(m.publicKey.toBase58(), m);
    return map;
  }, [markets]);

  if (!owner) return null;

  const rows = positions
    .map((p) => ({ position: p, market: marketByKey.get(p.account.market.toBase58()) }))
    .filter((r): r is { position: PositionRecord; market: MarketRecord } => !!r.market);

  return (
    <section>
      <SectionHead title="Your Positions" count={rows.length} />
      {rows.length === 0 ? (
        <div className="panel p-8 text-center text-sm text-mist">
          No positions yet. Back a side on a market above — your principal is always recoverable.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map(({ position, market }) => (
            <PositionRow
              key={position.publicKey.toBase58()}
              position={position}
              market={market}
              program={program}
              connection={connection}
              owner={owner}
              onDone={onDone}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function PositionRow({
  position,
  market,
  program,
  connection,
  owner,
  onDone,
}: {
  position: PositionRecord;
  market: MarketRecord;
  program: Program<Idl>;
  connection: Connection;
  owner: PublicKey;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const m = market.account;
  const pos = position.account;
  const side = sideKey(pos.side);
  const role = positionRole(m, pos);
  const claimable = canClaim(m, pos);
  const withdrawable = canWithdraw(m, pos);
  const locked = isLockedLoser(m, pos);

  async function run(kind: "claim" | "withdraw") {
    setBusy(true);
    const isClaim = kind === "claim";
    const id = toast.push({
      kind: "pending",
      title: isClaim ? "Claiming winnings…" : "Recovering principal…",
    });
    try {
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

  const accent = side === "yes" ? "text-yes" : "text-no";
  const alreadyDone =
    (role === "winner" && pos.yieldClaimed && pos.principalWithdrawn) ||
    ((role === "loser" || role === "void") && pos.principalWithdrawn);

  return (
    <div className="panel flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-display text-base font-semibold uppercase tracking-wide text-chalk">
            {m.proposition}
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-xs">
            <span className={clsx("kit-label", accent)}>{side?.toUpperCase()}</span>
            <span className="text-mist">·</span>
            <span className="led text-mist">
              {formatUsdc(pos.principal)} {PRINCIPAL_SYMBOL} staked
            </span>
          </div>
        </div>
        <RoleTag role={role} />
      </div>

      {/* role-specific body */}
      {role === "pending" && (
        <p className="text-xs text-mist">Awaiting the TxLINE result. Principal is working in the vault.</p>
      )}

      {role === "winner" && !alreadyDone && (
        <div className="rounded-xl border border-yes/25 bg-yes/[0.06] p-3">
          <div className="flex items-end justify-between">
            <div>
              <div className="kit-label text-[10px] text-mist">You collect</div>
              <div className="led led-glow text-2xl font-bold text-yes">
                {formatUsdc(claimEstimate(m, pos))}
              </div>
            </div>
            <div className="text-right">
              <div className="kit-label text-[10px] text-mist">of which bonus</div>
              <div className="led text-sm font-bold text-flood">+{formatUsdc(bonusEstimate(m, pos))}</div>
            </div>
          </div>
        </div>
      )}

      {role === "loser" && !alreadyDone && (
        <div className="rounded-xl border border-white/8 bg-pitch-800/60 p-3">
          {locked ? (
            <>
              <div className="kit-label text-[10px] text-mist">Principal recoverable in</div>
              <div className="led text-2xl font-bold text-chalk">
                <Countdown targetUnix={m.loserUnlockTs.toNumber()} doneLabel="Ready" />
              </div>
              <div className="mt-1 text-[11px] text-mist">100% back — you only forfeited this week&apos;s yield.</div>
            </>
          ) : (
            <div className="text-xs text-mist">Lock elapsed — recover 100% of your principal.</div>
          )}
        </div>
      )}

      {role === "void" && !alreadyDone && (
        <p className="text-xs text-mist">Market voided (one-sided). Refund your principal anytime.</p>
      )}

      {/* actions */}
      {alreadyDone ? (
        <div className="kit-label rounded-lg bg-white/5 py-2 text-center text-[11px] text-mist">
          {role === "winner" ? "Collected ✓" : "Recovered ✓"}
        </div>
      ) : role === "winner" ? (
        <Button variant="flood" loading={busy} disabled={!claimable} onClick={() => run("claim")}>
          Claim winnings
        </Button>
      ) : role === "loser" || role === "void" ? (
        <Button
          variant="outline"
          loading={busy}
          disabled={!withdrawable}
          onClick={() => run("withdraw")}
        >
          {withdrawable ? "Withdraw principal" : "Locked"}
        </Button>
      ) : null}
    </div>
  );
}

function RoleTag({ role }: { role: ReturnType<typeof positionRole> }) {
  const map = {
    pending: { label: "In play", cls: "text-flood border-flood/30 bg-flood/10" },
    winner: { label: "Winner", cls: "text-yes border-yes/30 bg-yes/10" },
    loser: { label: "Locked", cls: "text-no border-no/30 bg-no/10" },
    void: { label: "Void", cls: "text-mist border-white/15 bg-white/5" },
  } as const;
  const c = map[role];
  return (
    <span className={clsx("kit-label shrink-0 rounded-full border px-2.5 py-1 text-[10px]", c.cls)}>
      {c.label}
    </span>
  );
}

function SectionHead({ title, count }: { title: string; count: number }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <h2 className="font-display text-xl font-bold uppercase tracking-wide text-chalk">{title}</h2>
      <span className="led rounded-full bg-white/5 px-2 py-0.5 text-xs text-mist">{count}</span>
    </div>
  );
}
