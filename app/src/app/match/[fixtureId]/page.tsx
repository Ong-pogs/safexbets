import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MatchCenter } from "@/components/match/MatchCenter";
import { loadReplay } from "@/lib/replay/server";

/**
 * /match/[fixtureId] — the Match Center. Server-side: resolve the TxLINE replay (bundled fixture,
 * or live devnet when TXLINE_API_TOKEN is set) and hand it to the client orchestrator. Unknown
 * fixtures render the route's not-found state.
 */

interface MatchPageProps {
  params: { fixtureId: string };
}

function parseFixtureId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function generateMetadata({ params }: MatchPageProps): Promise<Metadata> {
  const id = parseFixtureId(params.fixtureId);
  const replay = id ? await loadReplay(id) : null;
  // 404 here, before streaming starts, so the route answers with a real 404 status
  // (the page body alone can't set it once loading.tsx has begun the stream).
  if (!replay) notFound();
  const { home, away } = replay.meta;
  return {
    title: `${home} vs ${away} — Match Center · SafeXBets`,
    description: `Replay ${home} vs ${away} on the SafeXBets Match Center: official TxLINE devnet match data with a 3D tracking visualization, tied to its no-loss on-chain market.`,
  };
}

export default async function MatchPage({ params }: MatchPageProps) {
  const id = parseFixtureId(params.fixtureId);
  if (!id) notFound();
  const replay = await loadReplay(id);
  if (!replay) notFound();

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 sm:px-6">
      <nav className="flex flex-wrap items-center justify-between gap-2" aria-label="Breadcrumb">
        <Link
          href="/matches"
          className="kit-label inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] text-mist transition hover:bg-white/5 hover:text-chalk"
        >
          ← All matches
        </Link>
        <span className="kit-label rounded-full border border-flood/25 bg-flood/[0.06] px-3 py-1 text-[10px] text-flood">
          Match Center
        </span>
      </nav>

      <MatchCenter replay={replay} />
    </main>
  );
}
