"use client";

import type { Idl, Program } from "@coral-xyz/anchor";
import type { Connection, PublicKey } from "@solana/web3.js";
import clsx from "clsx";
import { useMemo, useState } from "react";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { prettifyError } from "@/lib/errors";
import { formatUsdc, pct, poolShare, toBaseUnits } from "@/lib/format";
import { sendPlaceBet } from "@/lib/program";
import { PRINCIPAL_SYMBOL } from "@/lib/constants";
import type { MarketRecord, SideKey } from "@/lib/types";

const QUICK = [10, 50, 100, 500];

export function BetModal({
  record,
  program,
  connection,
  owner,
  balance,
  onClose,
  onDone,
}: {
  record: MarketRecord | null;
  program: Program<Idl>;
  connection: Connection;
  owner: PublicKey | undefined;
  balance: number | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [side, setSide] = useState<SideKey>("yes");
  const [amount, setAmount] = useState("100");
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const amountNum = Number(amount);
  const m = record?.account;

  // Implied share of the chosen side *after* this stake lands (a simple "your edge" preview).
  const preview = useMemo(() => {
    if (!m) return null;
    const add = Number.isFinite(amountNum) && amountNum > 0 ? toBaseUnits(amountNum) : toBaseUnits(0);
    const yes = side === "yes" ? m.yesPrincipal.add(add) : m.yesPrincipal;
    const no = side === "no" ? m.noPrincipal.add(add) : m.noPrincipal;
    const chosenShare = side === "yes" ? poolShare(yes, no) : poolShare(no, yes);
    return { chosenShare };
  }, [m, side, amountNum]);

  if (!record || !m) return null;

  const overBalance = balance != null && amountNum > balance;
  const valid = Number.isFinite(amountNum) && amountNum > 0 && !overBalance && !!owner;

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
    <Modal open onClose={onClose} title="Place your bet" subtitle={m.proposition}>
      <div className="flex flex-col gap-4">
        {/* side picker */}
        <div className="grid grid-cols-2 gap-3">
          <SidePick
            side="yes"
            active={side === "yes"}
            share={yesShare}
            onClick={() => setSide("yes")}
          />
          <SidePick
            side="no"
            active={side === "no"}
            share={1 - yesShare}
            onClick={() => setSide("no")}
          />
        </div>

        {/* amount */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="bet-amount" className="kit-label text-[10px] text-mist">
              Stake ({PRINCIPAL_SYMBOL})
            </label>
            <span className="led text-[11px] text-mist">
              Balance:{" "}
              {balance == null ? "—" : balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
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
            />
            <button
              type="button"
              onClick={() => balance != null && setAmount(String(balance))}
              className="kit-label shrink-0 rounded-lg border border-white/10 px-3 py-3 text-[11px] text-mist transition hover:border-flood/50 hover:text-flood"
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
                className="led rounded-lg border border-white/10 px-2.5 py-1 text-xs text-chalk-dim transition hover:border-flood/50 hover:text-flood"
              >
                {q}
              </button>
            ))}
          </div>
          {overBalance && <p className="mt-2 text-xs text-alert">Stake exceeds your balance.</p>}
        </div>

        {/* preview */}
        {preview && (
          <div className="flex items-center justify-between rounded-xl border border-white/8 bg-pitch-800/60 px-4 py-3">
            <span className="text-sm text-mist">Your side&apos;s implied share after stake</span>
            <span className="led text-lg font-bold text-chalk">{pct(preview.chosenShare)}</span>
          </div>
        )}

        <p className="text-xs leading-relaxed text-mist">
          Your <span className="text-chalk-dim">{formatUsdc(toBaseUnits(amountNum || 0))} {PRINCIPAL_SYMBOL}</span>{" "}
          principal is never at risk. Win and you take a share of the losers&apos; yield; lose and you
          recover 100% after a 7-day lock.
        </p>

        <Button variant={side === "yes" ? "yes" : "no"} size="lg" loading={busy} disabled={!valid} onClick={submit}>
          {busy ? "Confirming…" : `Back ${side.toUpperCase()} · ${amount || 0} ${PRINCIPAL_SYMBOL}`}
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
