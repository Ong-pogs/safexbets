"use client";

import clsx from "clsx";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Countdown } from "@/components/Countdown";
import { StatusBadge } from "@/components/StatusBadge";
import { useMarkets } from "@/hooks/useMarkets";
import { useNow } from "@/hooks/useNow";
import { useProgram } from "@/hooks/useProgram";
import type { FixturesPayload, LobbyFixture } from "@/lib/lobby";
import { marketPhase } from "@/lib/market-view";
import { sideKey, type MarketRecord } from "@/lib/types";

/**
 * The matches lobby: the TxLINE slate (live snapshot or bundled sample) grouped by day, each row
 * carrying kickoff + countdown, the pre-match line, and — when one exists on-chain — its market's
 * live status. Every row opens the fixture's Match Center.
 */
export function MatchesLobby() {
  const [data, setData] = useState<FixturesPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const { program } = useProgram();
  const { markets } = useMarkets(program);
  const now = useNow();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/txline/fixtures");
      if (!res.ok) throw new Error(`Fixtures request failed (${res.status})`);
      setData((await res.json()) as FixturesPayload);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load fixtures");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const marketByFixture = useMemo(() => {
    const map = new Map<number, MarketRecord>();
    for (const m of markets) map.set(m.account.matchId.toNumber(), m);
    return map;
  }, [markets]);

  const days = useMemo(() => (data ? groupByDay(data.fixtures) : []), [data]);

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold uppercase tracking-wide text-chalk sm:text-4xl">
            Matches
          </h1>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-mist">
            Markets open automatically ~48h before kickoff · settled by{" "}
            <span className="text-chalk-dim">TxLINE</span> on-chain. Back a call from any fixture&apos;s
            Match Center.
          </p>
        </div>
        {data && (
          <span
            className={clsx(
              "kit-label inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px]",
              data.source === "live"
                ? "border-flood/30 bg-flood/[0.06] text-flood"
                : "border-white/10 text-chalk-dim",
            )}
          >
            <span
              className={clsx(
                "h-1.5 w-1.5 rounded-full",
                data.source === "live" ? "bg-flood motion-safe:animate-live-pulse" : "bg-mist",
              )}
            />
            {data.source === "live" ? "TxLINE devnet · live slate" : "Sample fixtures"}
          </span>
        )}
      </header>

      {error && (
        <div className="rounded-xl border border-alert/25 bg-alert/[0.06] px-4 py-3 text-sm text-alert">
          {error}
          <button onClick={() => void load()} className="ml-3 underline underline-offset-2">
            Retry
          </button>
        </div>
      )}

      {loading && !data ? (
        <LobbySkeleton />
      ) : !data || data.fixtures.length === 0 ? (
        <div className="panel flex flex-col items-center gap-2 p-12 text-center">
          <span className="text-3xl" aria-hidden>
            ⚽
          </span>
          <p className="font-display text-lg uppercase tracking-wide text-chalk">No fixtures on the slate</p>
          <p className="max-w-sm text-sm text-mist">
            TxLINE returned an empty schedule. Check back closer to the next matchday — markets open
            automatically once fixtures land.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {days.map(({ label, fixtures }) => (
            <section key={label} aria-label={label}>
              <div className="mb-2.5 flex items-center gap-3">
                <h2 className="kit-label text-[11px] text-flood">{label}</h2>
                <div className="chalk-hr flex-1" />
              </div>
              <div className="flex flex-col gap-2.5">
                {fixtures.map((f, i) => (
                  <FixtureRow
                    key={f.fixtureId}
                    fixture={f}
                    market={marketByFixture.get(f.fixtureId)}
                    now={now}
                    index={i}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}

function FixtureRow({
  fixture,
  market,
  now,
  index,
}: {
  fixture: LobbyFixture;
  market: MarketRecord | undefined;
  now: number;
  index: number;
}) {
  const kickoffSecs = Math.floor(fixture.kickoffMs / 1000);
  const kickedOff = now >= kickoffSecs;
  const phase = market ? marketPhase(market.account, now) : null;

  return (
    <Link
      href={`/match/${fixture.fixtureId}`}
      className="panel group grid animate-rise-in grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-2 p-4 transition hover:border-flood/30 sm:grid-cols-[92px_minmax(0,1fr)_auto_auto] sm:gap-x-5"
      style={{ animationDelay: `${Math.min(index, 8) * 50}ms` }}
    >
      {/* kickoff */}
      <div className="min-w-0">
        <div className="led text-lg font-bold leading-tight text-chalk">
          {new Date(fixture.kickoffMs).toLocaleTimeString(undefined, {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
        <div className="led mt-0.5 text-[10px] text-mist">
          {kickedOff ? "Kicked off" : <Countdown targetUnix={kickoffSecs} doneLabel="Kicked off" />}
        </div>
      </div>

      {/* teams + line */}
      <div className="min-w-0">
        <div className="flex items-baseline gap-2 font-display text-lg font-semibold uppercase tracking-wide text-chalk">
          <span className="truncate">{fixture.home}</span>
          <span className="shrink-0 text-[11px] text-mist">vs</span>
          <span className="truncate text-chalk-dim">{fixture.away}</span>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-mist">
          {fixture.proposition && <span className="truncate">{fixture.proposition}</span>}
          {fixture.odds && (
            <span className="led shrink-0">
              <span className="text-yes">{fixture.odds.yes.toFixed(2)}</span>
              <span className="mx-1 text-mist">/</span>
              <span className="text-no">{fixture.odds.no.toFixed(2)}</span>
              <span className="ml-1.5 text-[9px] uppercase tracking-wider text-mist">TxLINE</span>
            </span>
          )}
        </div>
      </div>

      {/* market state */}
      <div className="col-start-2 sm:col-start-3">
        {market && phase ? (
          phase === "betting" ? (
            <span className="kit-label inline-flex items-center gap-2 rounded-full border border-yes/40 bg-yes/10 px-3 py-1 text-[11px] text-yes">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-live-pulse rounded-full bg-yes" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-yes" />
              </span>
              Market live
            </span>
          ) : (
            <StatusBadge phase={phase} winner={sideKey(market.account.winnerSide)} />
          )
        ) : kickedOff ? (
          <span className="kit-label rounded-full border border-white/10 px-3 py-1 text-[10px] text-mist">
            Finished
          </span>
        ) : (
          <span className="kit-label rounded-full border border-white/8 px-3 py-1 text-[10px] text-mist/80">
            Market opens pre-kickoff
          </span>
        )}
      </div>

      {/* CTA */}
      <span className="kit-label col-start-2 justify-self-start rounded-xl border border-white/15 px-3.5 py-2 text-[11px] text-chalk transition group-hover:border-flood/60 group-hover:text-flood sm:col-start-4 sm:justify-self-end">
        Match Center →
      </span>
    </Link>
  );
}

function LobbySkeleton() {
  return (
    <div className="flex flex-col gap-2.5" aria-busy="true" aria-label="Loading fixtures">
      <div className="h-4 w-40 animate-pulse rounded bg-white/5" />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="panel h-[76px] animate-pulse opacity-60" />
      ))}
    </div>
  );
}

function groupByDay(fixtures: LobbyFixture[]): Array<{ label: string; fixtures: LobbyFixture[] }> {
  const groups = new Map<string, { label: string; fixtures: LobbyFixture[] }>();
  for (const f of fixtures) {
    const d = new Date(f.kickoffMs);
    const key = d.toDateString();
    if (!groups.has(key)) groups.set(key, { label: dayLabel(d), fixtures: [] });
    groups.get(key)!.fixtures.push(f);
  }
  return [...groups.values()];
}

function dayLabel(d: Date): string {
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 86_400_000);
  const datePart = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  if (d.toDateString() === today.toDateString()) return `Today · ${datePart}`;
  if (d.toDateString() === tomorrow.toDateString()) return `Tomorrow · ${datePart}`;
  return datePart;
}
