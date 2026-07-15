"use client";

import { PublicKey } from "@solana/web3.js";
import Link from "next/link";
import { useCallback, useMemo } from "react";
import { ConfigBanner } from "@/components/ConfigBanner";
import { DemoControls } from "@/components/DemoControls";
import { useMarkets } from "@/hooks/useMarkets";
import { useProgram } from "@/hooks/useProgram";
import { CONFIG, IS_PRINCIPAL_MINT_MISSING } from "@/lib/config";

/**
 * /operator — the Match Control booth, off the consumer home. In normal operation the relayer
 * keeper runs the market lifecycle unattended; this page exists for demos and manual intervention
 * by a market authority.
 */
export default function OperatorPage() {
  const { program, connection, wallet } = useProgram();
  const owner = wallet?.publicKey;

  const principalMint = useMemo(() => {
    if (IS_PRINCIPAL_MINT_MISSING) return null;
    try {
      return new PublicKey(CONFIG.principalMint);
    } catch {
      return null;
    }
  }, []);

  const { markets, reload: reloadMarkets } = useMarkets(program);
  const reloadAll = useCallback(() => {
    void reloadMarkets();
  }, [reloadMarkets]);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-8 sm:px-6 sm:py-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold uppercase tracking-wide text-chalk sm:text-4xl">
            Operator booth
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-mist">
            Not needed in normal play: the relayer <span className="text-chalk-dim">keeper</span>{" "}
            opens a market for every TxLINE fixture ~48h before kickoff and settles it from the
            official result automatically. This booth is for demos — author a market by hand, post a
            result, stack simulated yield.
          </p>
        </div>
        <Link
          href="/matches"
          className="kit-label rounded-lg px-2 py-1 text-[11px] text-flood transition hover:bg-flood/10"
        >
          ← Back to matches
        </Link>
      </header>

      <ConfigBanner />

      {owner ? (
        <DemoControls
          markets={markets}
          program={program}
          connection={connection}
          owner={owner}
          principalMint={principalMint}
          onDone={reloadAll}
        />
      ) : (
        <div className="panel p-10 text-center">
          <p className="font-display text-lg uppercase tracking-wide text-chalk">
            Connect the operator wallet
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm text-mist">
            Market authorship and settlement are signed on-chain actions. Connect the wallet that
            authors your demo markets to open the booth.
          </p>
        </div>
      )}

      <p className="text-[11px] leading-relaxed text-mist/80">
        Keeper reference: <span className="led text-chalk-dim">relayer — npm run keeper</span> (opens
        upcoming fixtures inside its horizon, settles finished ones from TxLINE). Manual booth actions
        here use the same program instructions with your wallet as authority.
      </p>
    </main>
  );
}
