"use client";

import { PublicKey } from "@solana/web3.js";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { BetModal } from "@/components/BetModal";
import { ConfigBanner } from "@/components/ConfigBanner";
import { DemoControls } from "@/components/DemoControls";
import { MarketsBoard } from "@/components/MarketsBoard";
import { PitchBackdrop } from "@/components/PitchBackdrop";
import { Portfolio } from "@/components/Portfolio";
import { useMarkets } from "@/hooks/useMarkets";
import { usePositions } from "@/hooks/usePositions";
import { useProgram } from "@/hooks/useProgram";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import { CONFIG, IS_PRINCIPAL_MINT_MISSING } from "@/lib/config";
import { TXLINE_COMPETITION, TXLINE_LABEL } from "@/lib/txline";
import type { MarketRecord } from "@/lib/types";

export default function Home() {
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

  const { markets, loading, error, reload: reloadMarkets } = useMarkets(program);
  const { positions, reload: reloadPositions } = usePositions(program, owner);
  const { amount: balance, reload: reloadBalance } = useTokenBalance(
    connection,
    owner,
    principalMint ?? undefined,
  );

  const [betRecord, setBetRecord] = useState<MarketRecord | null>(null);

  const reloadAll = useCallback(() => {
    void reloadMarkets();
    void reloadPositions();
    void reloadBalance();
  }, [reloadMarkets, reloadPositions, reloadBalance]);

  return (
    <>
      <PitchBackdrop />
      <AppHeader balance={balance} />

      <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
        <Hero />
        <FeaturedMatchCenter />
        <ConfigBanner />

        <MarketsBoard
          markets={markets}
          loading={loading}
          error={error}
          connected={!!owner}
          owner={owner}
          onBet={setBetRecord}
        />

        {owner ? (
          <>
            <Portfolio
              positions={positions}
              markets={markets}
              program={program}
              connection={connection}
              owner={owner}
              onDone={reloadAll}
            />
            <DemoControls
              markets={markets}
              program={program}
              connection={connection}
              owner={owner}
              principalMint={principalMint}
              onDone={reloadAll}
            />
          </>
        ) : (
          <div className="panel p-8 text-center">
            <p className="font-display text-lg uppercase tracking-wide text-chalk">
              Connect a devnet wallet
            </p>
            <p className="mx-auto mt-1 max-w-md text-sm text-mist">
              Connect to see your positions, place bets, and — as a market authority — open the Match
              Control booth to run the demo.
            </p>
          </div>
        )}

        <Footer />
      </main>

      <BetModal
        record={betRecord}
        program={program}
        connection={connection}
        owner={owner}
        balance={balance}
        onClose={() => setBetRecord(null)}
        onDone={reloadAll}
      />
    </>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/8 bg-gradient-to-b from-white/[0.04] to-transparent px-6 py-8 sm:px-10 sm:py-12">
      <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-flood/10 blur-3xl" />
      <div className="relative">
        <div className="kit-label mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-[10px] text-flood">
          <span className="h-1.5 w-1.5 animate-live-pulse rounded-full bg-flood" />
          No-loss prediction markets · Solana devnet
        </div>
        <h1 className="max-w-3xl font-display text-4xl font-bold uppercase leading-[0.98] tracking-tight text-chalk sm:text-6xl">
          Back a call. Keep your <span className="text-flood">principal</span>. Win the losers&apos;{" "}
          <span className="text-yes">yield</span>.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-chalk-dim">
          Deposit into a World Cup market, pick <span className="text-yes">Yes</span> or{" "}
          <span className="text-no">No</span>, and{" "}
          <span className="text-chalk">TxLINE settles it on-chain</span>. Winners take the losers&apos;
          yield instantly; losers lock principal for 7 days, then recover{" "}
          <span className="text-chalk">100%</span>. A clean sheet — concede nothing.
        </p>

        <div className="mt-7">
          <div className="kit-label mb-2 text-[10px] text-mist">How it works</div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Step n="01" title="Back a side" body="Deposit mock-USDC on Yes or No. Odds emerge from the pools." />
            <Step n="02" title="TxLINE settles" body="The oracle posts the match result on-chain. No pricing engine." />
            <Step n="03" title="Clean sheet" body="Winners take the losers' yield; losers recover every cent of principal." />
          </div>
        </div>

        <p className="mt-6 text-[11px] text-mist">
          Odds by <span className="text-chalk-dim">{TXLINE_LABEL}</span> · {TXLINE_COMPETITION}
        </p>
      </div>
    </section>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-pitch-800/40 p-4">
      <div className="led text-sm text-flood">{n}</div>
      <div className="mt-1 font-display text-base font-semibold uppercase tracking-wide text-chalk">
        {title}
      </div>
      <p className="mt-1 text-xs leading-relaxed text-mist">{body}</p>
    </div>
  );
}

/**
 * Featured Match Center entry: the bundled Brazil–Norway TxLINE replay (fixture 18187298 — the
 * one devnet fixture with a full stored replay, also served by /api/txline/replay).
 */
function FeaturedMatchCenter() {
  return (
    <Link
      href="/match/18187298"
      className="panel group relative flex flex-wrap items-center justify-between gap-4 overflow-hidden p-5 transition hover:border-flood/30 sm:p-6"
    >
      {/* faint chalk pitch-lines motif */}
      <svg
        className="pointer-events-none absolute -right-6 top-1/2 h-[220%] w-56 -translate-y-1/2 opacity-[0.07] transition-opacity group-hover:opacity-[0.12]"
        viewBox="0 0 200 300"
        fill="none"
        stroke="#EEFBF1"
        strokeWidth="2"
        aria-hidden
      >
        <rect x="10" y="10" width="180" height="280" />
        <line x1="10" y1="150" x2="190" y2="150" />
        <circle cx="100" cy="150" r="38" />
        <rect x="45" y="10" width="110" height="46" />
        <rect x="45" y="244" width="110" height="46" />
      </svg>

      <div className="relative min-w-0">
        <div className="kit-label mb-1.5 inline-flex items-center gap-2 text-[10px] text-flood">
          <span className="h-1.5 w-1.5 rounded-full bg-flood motion-safe:animate-live-pulse" />
          Match Center · full replay
        </div>
        <div className="font-display text-2xl font-bold uppercase leading-tight tracking-wide text-chalk sm:text-3xl">
          Brazil <span className="text-mist">vs</span> Norway{" "}
          <span className="led led-glow ml-1 text-flood">1–2</span>
        </div>
        <p className="mt-1 max-w-md text-xs leading-relaxed text-mist">
          Every TxLINE event of the devnet replay — goals, VAR drama, the late penalty — on a 3D
          pitch, wired to its on-chain market.
        </p>
      </div>

      <span className="kit-label relative shrink-0 rounded-xl bg-flood px-4 py-2.5 text-sm text-pitch-900 transition group-hover:shadow-[0_10px_26px_-10px_rgba(203,255,62,0.6)]">
        Watch the replay →
      </span>
    </Link>
  );
}

function Footer() {
  return (
    <footer className="mt-4 border-t border-white/8 pt-6 text-xs text-mist">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>
          SafeXBets · <span className="text-chalk-dim">You stake time, not money.</span>
        </span>
        <span>Devnet · unaudited hackathon build · not financial advice</span>
      </div>
      <p className="mt-2 max-w-3xl text-[11px] leading-relaxed text-mist/80">
        Experimental software on Solana devnet using mock USDC — no real-money wagering, no
        inducement to gamble. 18+ where prediction games are age-restricted; play for the sport,
        not the stake. Match data is a TxLINE devnet replay; the 3D pitch view is a Metrica
        open-data demo visualization.
      </p>
    </footer>
  );
}
